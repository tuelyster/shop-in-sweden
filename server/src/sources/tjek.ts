import type { Quantity, UnitSymbol } from '@shop-in-sweden/shared';
import type { Store } from '../catalogue';
import { localDate } from '../dates';
import type { ObservationDraft } from '../prices/store';
import { getJson, pause, type Importer } from './http';

const API = 'https://squid-api.tjek.com/v2';
const PAGE_SIZE = 100;
/** Safety stop per catalog or catalog list. The largest catalogs hold a few hundred Offers. */
const MAX_PAGES = 20;
/** Tjek chooses the country from the coordinates, so Danish Retailers are queried from Copenhagen. */
const COPENHAGEN = { lat: 55.676, lng: 12.568 };
const SEARCH_RADIUS_M = 20000;
/** Words that mark an Offer as member-only whatever the Retailer; ICA's Stammis offers are not collected anyway. */
const GENERIC_MEMBER_PHRASES = ['stammis'];

const UNITS: ReadonlySet<string> = new Set<UnitSymbol>(['kg', 'g', 'l', 'dl', 'cl', 'ml', 'pcs']);

interface TjekRange {
  from?: number | null;
  to?: number | null;
}

export interface TjekOffer {
  id: string;
  heading?: string | null;
  description?: string | null;
  pricing?: { price?: number | null; currency?: string | null } | null;
  quantity?: {
    unit?: { symbol?: string | null; si?: { factor?: number | null } | null } | null;
    size?: TjekRange | null;
    pieces?: TjekRange | null;
  } | null;
  run_from?: string | null;
  run_till?: string | null;
}

export interface TjekCatalog {
  id: string;
  label?: string | null;
  run_from: string;
  run_till: string;
  offer_count?: number | null;
}

interface TjekStoreInfo {
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * A single value from a Tjek range. Sizes and piece counts are sometimes ranges ("400-500 g",
 * "7.5-500 g" for a spice assortment), in which case the Offer says nothing definite about what
 * one pays for. Such an Offer gets no quantity and is rejected by the Match Rule rather than priced
 * at a guessed size.
 */
function exactly(range: TjekRange | null | undefined): number | null {
  const from = range?.from;
  const to = range?.to ?? from;
  if (typeof from !== 'number' || typeof to !== 'number' || from <= 0) return null;
  return Math.abs(from - to) < 1e-9 ? from : null;
}

/** pieces x size x unit, as Tjek reports them: "2 for 40" has pieces 2, a multipack of 15 x 33 cl has pieces 15. */
export function offerQuantity(offer: TjekOffer): Quantity | null {
  const symbol = offer.quantity?.unit?.symbol;
  if (!symbol || !UNITS.has(symbol)) return null;
  const size = exactly(offer.quantity?.size);
  const pieces = offer.quantity?.pieces ? exactly(offer.quantity.pieces) : 1;
  if (size === null || pieces === null) return null;
  return { pieces, size, unit: symbol as UnitSymbol };
}

/** The text a Match Rule sees: heading and description, without "gäller ej ..." exceptions that would trip excluded words. */
export function offerText(offer: TjekOffer): string {
  const description = (offer.description ?? '')
    .replace(/\b(gäller ej|gäller inte|gælder ikke)[^.\n]*\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const heading = (offer.heading ?? '').replace(/\s+/g, ' ').trim();
  return description ? `${heading} | ${description}` : heading;
}

/** True when the Offer text carries one of the Retailer's member-only phrases (case-insensitive). */
export function isMemberOnly(offer: TjekOffer, phrases: string[]): boolean {
  const haystack = `${offer.heading ?? ''}\n${offer.description ?? ''}`.toLowerCase();
  return [...phrases, ...GENERIC_MEMBER_PHRASES].some((p) => p.trim() !== '' && haystack.includes(p.toLowerCase()));
}

function toDraft(offer: TjekOffer, catalog: TjekCatalog, retailerId: string, storeId: string | null, memberPhrases: string[]): ObservationDraft | null {
  const price = offer.pricing?.price;
  const currency = offer.pricing?.currency;
  if (typeof price !== 'number' || !(price > 0) || (currency !== 'SEK' && currency !== 'DKK')) return null;
  const validFrom = localDate(new Date(offer.run_from ?? catalog.run_from));
  const validTo = localDate(new Date(offer.run_till ?? catalog.run_till));
  if (validFrom > validTo) return null;
  return {
    source: 'tjek',
    retailerId,
    storeId,
    productId: offer.id,
    productText: offerText(offer),
    foundBy: [],
    price,
    currency,
    quantity: offerQuantity(offer),
    kind: 'offer',
    memberOnly: isMemberOnly(offer, memberPhrases),
    validFrom,
    validTo,
  };
}

function normalise(text: string | null | undefined): string {
  return (text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * The catalogs that hold a Swedish Store's Offers. Store leaflets are named after the Tjek store
 * ("Willys Malmö Emporia"); a dealer without such a leaflet publishes national ones ("Vecka 41"),
 * recognisable by a label that does not start with the Retailer's own name. Either way only the
 * Offers at this Store count, because the Price Observation is tied to it.
 */
export function chooseStoreCatalogs(catalogs: TjekCatalog[], tjekStoreName: string, retailerName: string): TjekCatalog[] {
  const own = catalogs.filter((c) => normalise(c.label) === normalise(tjekStoreName));
  if (own.length > 0) return own;
  const brand = normalise(retailerName);
  return catalogs.filter((c) => !normalise(c.label).startsWith(brand));
}

function isArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Unexpected Tjek ${what} response shape`);
  return value;
}

/**
 * Weekly leaflet Offers from Tjek, unofficial (ADR 0002). Swedish Stores are found with their own
 * coordinates and Danish Retailers with Copenhagen's, because Tjek answers one country per query.
 * Every catalog still running is read, so next week's leaflet is already there for a later Trip Date.
 * All requests go one after another with a pause. Offers are stored with their validity dates; whether
 * one counts is decided against the Trip Date when prices are evaluated.
 */
export const tjekImporter: Importer = {
  name: 'tjek',
  async run({ fetch, catalogue, now, delayMs }) {
    let requests = 0;
    const get = async (path: string, query: Record<string, string | number>): Promise<unknown> => {
      if (requests++ > 0) await pause(delayMs);
      const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]));
      return getJson(fetch, `${API}${path}${qs.size > 0 ? `?${qs}` : ''}`);
    };

    const today = localDate(now);
    const retailers = new Map(catalogue.retailers.map((r) => [r.id, r]));
    const storeInfo = new Map<string, TjekStoreInfo>();
    const catalogLists = new Map<string, TjekCatalog[]>();
    const offerLists = new Map<string, TjekOffer[]>();

    async function listCatalogs(dealerId: string, lat: number, lng: number): Promise<TjekCatalog[]> {
      const key = `${dealerId}|${lat}|${lng}`;
      const known = catalogLists.get(key);
      if (known) return known;
      const found: TjekCatalog[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const body = isArray(
          await get('/catalogs', { dealer_ids: dealerId, r_lat: lat, r_lng: lng, r_radius: SEARCH_RADIUS_M, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
          'catalogs',
        ) as TjekCatalog[];
        found.push(...body);
        if (body.length < PAGE_SIZE) break;
      }
      // A leaflet that has ended, or has no Offers, cannot matter for any Trip Date from now on.
      const live = found.filter((c) => (c.offer_count ?? 1) > 0 && localDate(new Date(c.run_till)) >= today);
      catalogLists.set(key, live);
      return live;
    }

    async function catalogOffers(catalogId: string): Promise<TjekOffer[]> {
      const known = offerLists.get(catalogId);
      if (known) return known;
      const found: TjekOffer[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const body = isArray(await get('/offers', { catalog_id: catalogId, limit: PAGE_SIZE, offset: page * PAGE_SIZE }), 'offers') as TjekOffer[];
        found.push(...body);
        if (body.length < PAGE_SIZE) break;
      }
      offerLists.set(catalogId, found);
      return found;
    }

    async function tjekStore(store: Store): Promise<TjekStoreInfo> {
      const known = storeInfo.get(store.tjekStoreId!);
      if (known) return known;
      const body = (await get(`/stores/${encodeURIComponent(store.tjekStoreId!)}`, {})) as Partial<TjekStoreInfo> | null;
      if (!body || typeof body.name !== 'string' || typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
        throw new Error(`Unexpected Tjek store response shape for ${store.name}`);
      }
      const info = { name: body.name, latitude: body.latitude, longitude: body.longitude };
      storeInfo.set(store.tjekStoreId!, info);
      return info;
    }

    const observations: ObservationDraft[] = [];

    for (const store of catalogue.stores) {
      if (!store.tjekDealerId || !store.tjekStoreId) continue;
      const retailer = retailers.get(store.retailerId);
      if (!retailer) continue;
      const info = await tjekStore(store);
      const catalogs = chooseStoreCatalogs(await listCatalogs(store.tjekDealerId, info.latitude, info.longitude), info.name, retailer.name);
      for (const catalog of catalogs) {
        for (const offer of await catalogOffers(catalog.id)) {
          const draft = toDraft(offer, catalog, retailer.id, store.id, retailer.memberOfferPhrases);
          if (draft) observations.push(draft);
        }
      }
    }

    for (const retailer of catalogue.retailers) {
      if (retailer.country !== 'DK' || !retailer.tjekDealerId) continue;
      for (const catalog of await listCatalogs(retailer.tjekDealerId, COPENHAGEN.lat, COPENHAGEN.lng)) {
        for (const offer of await catalogOffers(catalog.id)) {
          const draft = toDraft(offer, catalog, retailer.id, null, retailer.memberOfferPhrases);
          if (draft) observations.push(draft);
        }
      }
    }

    return { observations };
  },
};
