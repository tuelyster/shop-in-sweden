import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** What a recorded Tjek session holds: Tjek stores, catalogs (tagged with where they were found) and their Offers. */
export interface TjekData {
  stores: Record<string, { id: string; name: string; latitude: number; longitude: number; dealer_id: string }>;
  catalogs: { id: string; label: string; run_from: string; run_till: string; offer_count: number; dealer_id: string; _region: 'hyllie' | 'vala' | 'copenhagen' }[];
  offers: Record<string, Record<string, unknown>[]>;
}

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures');

/**
 * Tjek's answers recorded on 2026-10-08 for the six Swedish Stores (Swedish coordinates) and the five
 * Danish Retailers (Copenhagen), with the Offers trimmed to those a Basket Item could match plus a few
 * member-only ones.
 */
export const recordedTjek = JSON.parse(readFileSync(resolve(fixtureDir, 'tjek.json'), 'utf8')) as TjekData;

/** The recorded Tjek stores but no leaflets: for tests about regular prices, which should not see Offers. */
export const noLeaflets: TjekData = { ...recordedTjek, catalogs: [], offers: {} };

export function regionOf(lng: number): TjekData['catalogs'][number]['_region'] {
  return lng > 12.9 ? 'hyllie' : lng > 12.7 ? 'vala' : 'copenhagen';
}

/** Serves a Tjek session like the real API: a country per query (by coordinates), `limit` and `offset` paging. */
export function replayTjek(url: URL, data: TjekData = recordedTjek): Response {
  const page = <T>(all: T[]): T[] => {
    const limit = Number(url.searchParams.get('limit') ?? 24);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    return all.slice(offset, offset + limit);
  };
  if (url.pathname.startsWith('/v2/stores/')) {
    const store = data.stores[decodeURIComponent(url.pathname.slice('/v2/stores/'.length))];
    return store ? Response.json(store) : new Response('Not found', { status: 404 });
  }
  if (url.pathname === '/v2/catalogs') {
    const region = regionOf(Number(url.searchParams.get('r_lng')));
    const dealers = (url.searchParams.get('dealer_ids') ?? '').split(',').filter(Boolean);
    const found = data.catalogs.filter((c) => c._region === region && (dealers.length === 0 || dealers.includes(c.dealer_id)));
    return Response.json(page(found));
  }
  if (url.pathname === '/v2/offers') {
    return Response.json(page(data.offers[url.searchParams.get('catalog_id') ?? ''] ?? []));
  }
  return new Response('Not found', { status: 404 });
}

interface OfferSpec {
  id: string;
  heading: string;
  description?: string;
  price: number;
  /** Tjek's unit symbol and size, e.g. 'l' and 1. */
  unit?: string;
  size?: number | [number, number];
  pieces?: number;
  /** ISO timestamps as Tjek reports them (UTC). */
  from?: string;
  till?: string;
  currency?: 'SEK' | 'DKK';
}

/** An Offer in Tjek's shape; by default valid 5-11 October local time (UTC 4 Oct 22:00 to 11 Oct 21:59:59). */
export function tjekOffer(spec: OfferSpec): Record<string, unknown> {
  const [from, to] = Array.isArray(spec.size) ? spec.size : [spec.size ?? 1, spec.size ?? 1];
  return {
    id: spec.id,
    heading: spec.heading,
    description: spec.description ?? '',
    pricing: { price: spec.price, pre_price: null, currency: spec.currency ?? 'SEK' },
    quantity: {
      unit: { symbol: spec.unit ?? 'l', si: { symbol: 'l', factor: 1 } },
      size: { from, to },
      pieces: { from: spec.pieces ?? 1, to: spec.pieces ?? 1 },
    },
    run_from: spec.from ?? '2026-10-04T22:00:00+0000',
    run_till: spec.till ?? '2026-10-11T21:59:59+0000',
  };
}
