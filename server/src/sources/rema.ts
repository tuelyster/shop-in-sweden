import type { Quantity } from '@shop-in-sweden/shared';
import { nameAlternatives, textMatchesPhrase } from '../match/match-rule';
import type { ObservationDraft } from '../prices/store';
import { getJson, isoDate, pause, type Importer } from './http';
import { parseQuantity } from './quantity';

const HOST = ['api', 'digital', 'rema1000', 'dk'].join('.');
const PRODUCTS_URL = `https://${HOST}/api/v3/products`;
const PAGE_SIZE = 100;
/** Safety stop: the whole catalogue is about 40 pages of 100. */
const MAX_PAGES = 100;

interface RemaPrice {
  price: number;
  is_campaign: boolean;
  starting_at: string;
  ending_at: string;
}

interface RemaProduct {
  id: number;
  name: string;
  underline?: string | null;
  labels?: { name: string }[] | null;
  prices: RemaPrice[];
}

interface RemaPage {
  data: RemaProduct[];
  meta: { pagination: { last_page: number } };
}

function isPage(value: unknown): value is RemaPage {
  const v = value as RemaPage | null;
  return !!v && Array.isArray(v.data) && typeof v.meta?.pagination?.last_page === 'number';
}

/** The regular (non-campaign) price in force on `today`: the latest one that has started and not ended. */
function regularPrice(product: RemaProduct, today: string): RemaPrice | null {
  const active = product.prices
    .filter((p) => !p.is_campaign && p.starting_at.slice(0, 10) <= today && p.ending_at.slice(0, 10) >= today)
    .sort((a, b) => b.starting_at.localeCompare(a.starting_at));
  return active[0] ?? null;
}

function productText(p: RemaProduct): string {
  const base = p.underline ? `${p.name} | ${p.underline}` : p.name;
  const labels = (p.labels ?? []).map((l) => l.name);
  return labels.length > 0 ? `${base} [${labels.join(', ')}]` : base;
}

/** REMA writes the pack size first ("500 GR. / BRAND"); toilet paper is sized in grams but counted in rolls ("8 RULLER"). */
function remaQuantity(underline: string | null | undefined): Quantity | null {
  if (!underline) return null;
  const rolls = /(\d+)\s*rulle/i.exec(underline);
  if (rolls) return { pieces: Number(rolls[1]), size: 1, unit: 'pcs' };
  return parseQuantity(underline.split('/')[0]);
}

/**
 * REMA 1000 regular prices (Denmark). The v3 products endpoint ignores its `search` parameter and
 * simply pages through the whole catalogue, so the importer reads every page (one request after
 * another) and searches locally with each Basket Item's Danish search words and name words.
 */
export const remaImporter: Importer = {
  name: 'rema',
  async run({ fetch, catalogue, now, delayMs }) {
    const catalogueProducts: RemaProduct[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (page > 1) await pause(delayMs);
      const body = await getJson(fetch, `${PRODUCTS_URL}?per_page=${PAGE_SIZE}&page=${page}`);
      if (!isPage(body)) throw new Error(`Unexpected REMA 1000 products response shape on page ${page}`);
      catalogueProducts.push(...body.data);
      if (page >= body.meta.pagination.last_page) break;
    }

    const today = isoDate(now);
    const observations: ObservationDraft[] = [];
    for (const product of catalogueProducts) {
      const text = productText(product);
      const foundBy = new Set<string>();
      let relevant = false;
      for (const item of catalogue.basketItems) {
        for (const word of item.matchRule.searchWords.DK) {
          if (textMatchesPhrase(text, word)) {
            foundBy.add(word);
            relevant = true;
          }
        }
        const alternatives = nameAlternatives(item.matchRule, 'DK');
        if (alternatives !== 'found-by' && alternatives.some((a) => textMatchesPhrase(text, a))) relevant = true;
      }
      if (!relevant) continue;
      const price = regularPrice(product, today);
      if (!price) continue;
      observations.push({
        source: 'rema',
        retailerId: 'rema1000',
        productId: String(product.id),
        productText: text,
        foundBy: [...foundBy],
        price: price.price,
        currency: 'DKK',
        quantity: remaQuantity(product.underline),
        kind: 'regular',
        validFrom: price.starting_at.slice(0, 10),
        validTo: price.ending_at.startsWith('2099') ? null : price.ending_at.slice(0, 10),
      });
    }
    return { observations };
  },
};
