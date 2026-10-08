import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CategoryPriceGap, ReferenceData } from '@shop-in-sweden/shared';
import { createApp } from '../src/app';
import { openDatabase, type Db } from '../src/db/connection';
import { runImport } from '../src/import/run-import';
import { recordImportRun, type ObservationDraft } from '../src/prices/store';
import { seedDatabase } from '../src/seed';
import { noLeaflets, replayTjek } from './tjek-fake';

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string) => readFileSync(resolve(fixtureDir, name), 'utf8');
const willysSearches = JSON.parse(fixture('willys-search.json')) as Record<string, unknown>;
const remaPage = fixture('rema-products.json');
const ecbCsv = fixture('ecb-exr.csv');

const NOW = new Date('2026-10-08T10:00:00Z');
const TRIP_DATE = '2026-10-10';
// The recorded ECB rate: 7.4745 DKK per EUR over 11.224 SEK per EUR.
const SEK_TO_DKK = 7.4745 / 11.224;

/** Replays the recorded responses; anything not recorded is an empty result. */
const fakeFetch = (async (input: string | URL | Request) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname.includes('tjek')) return replayTjek(url, noLeaflets);
  if (url.hostname.includes('willys')) {
    return Response.json(
      willysSearches[url.searchParams.get('q') ?? ''] ?? {
        results: [],
        pagination: { pageSize: 100, currentPage: 0, numberOfPages: 1, totalNumberOfResults: 0 },
      },
    );
  }
  if (url.hostname.includes('rema1000')) {
    return new Response(remaPage, { headers: { 'content-type': 'application/json' } });
  }
  return new Response(ecbCsv);
}) as typeof fetch;

function importFixtures(db: Db, sources?: string[]) {
  return runImport(db, { sources, fetch: fakeFetch, now: () => NOW, delayMs: 0 });
}

/** A price another Retailer would report, for cases the recorded Willys and REMA responses do not cover. */
function extraObservation(o: Partial<ObservationDraft> & Pick<ObservationDraft, 'retailerId' | 'productId' | 'productText' | 'price'>): ObservationDraft {
  return {
    source: 'test',
    foundBy: [],
    currency: o.retailerId === 'netto' ? 'DKK' : 'SEK',
    quantity: { pieces: 1, size: 1, unit: 'l' },
    kind: 'regular',
    validFrom: '2026-10-08',
    ...o,
  };
}

function addObservations(db: Db, observations: ObservationDraft[]) {
  recordImportRun(db, { source: 'test', startedAt: NOW, finishedAt: NOW, observations });
}

async function referenceData(db: Db, tripDate = TRIP_DATE): Promise<ReferenceData> {
  const res = await createApp(db).request(`/api/reference-data?dato=${tripDate}`);
  expect(res.status).toBe(200);
  return (await res.json()) as ReferenceData;
}

function category(data: ReferenceData, destinationId: string, categoryId: string): CategoryPriceGap {
  const found = data.priceGaps.find((d) => d.destinationId === destinationId)!.categories.find((c) => c.categoryId === categoryId);
  expect(found, `${categoryId} at ${destinationId}`).toBeDefined();
  return found!;
}

function item(data: ReferenceData, destinationId: string, categoryId: string, name: string) {
  const found = category(data, destinationId, categoryId).items.find((i) => i.name === name);
  expect(found, name).toBeDefined();
  return found!;
}

describe('Price Gaps in the reference data', () => {
  let db: Db;

  beforeEach(() => {
    db = openDatabase(':memory:');
    seedDatabase(db);
  });

  it('knows no gaps on a freshly seeded database: unknown, not 0 %', async () => {
    const data = await referenceData(db);
    expect(data.exchangeRate).toBeNull();
    expect(data.categories.map((c) => c.id)).toEqual(['groceries', 'candy-snacks', 'soft-drinks', 'personal-care-household']);
    expect(data.priceGaps.map((d) => d.destinationId).sort()).toEqual(['hyllie', 'vala']);
    for (const destination of data.priceGaps) {
      expect(destination.categories).toHaveLength(4);
      for (const c of destination.categories) {
        expect(c.priceGap).toBeNull();
        expect(c.missingItems).toHaveLength(c.items.length);
      }
    }
  });

  describe('after importing the recorded responses', () => {
    let data: ReferenceData;

    beforeEach(async () => {
      await importFixtures(db);
      data = await referenceData(db);
    });

    it('returns the exchange rate used, with its date', () => {
      expect(data.exchangeRate).toMatchObject({ date: '2026-10-07', sekToDkk: SEK_TO_DKK });
      expect(data.exchangeRate!.source).toContain('ECB');
    });

    it('converts the Swedish Unit Price to DKK at that rate and compares it with the Danish one', () => {
      const milk = item(data, 'hyllie', 'groceries', 'Whole milk');
      // Willys 16.90 SEK for 1.5 l against REMA 1000 13.50 DKK for 1 l.
      expect(milk.sweden).toMatchObject({
        productName: 'Mjölk Längre Hållbarhet 3% | GARANT, 1,5l',
        seller: 'Willys Emporia',
        currency: 'SEK',
        per: 'l',
        kind: 'regular',
        validTo: null,
      });
      expect(milk.sweden!.unitPrice).toBeCloseTo(16.9 / 1.5, 10);
      expect(milk.sweden!.unitPriceDkk).toBeCloseTo((16.9 / 1.5) * SEK_TO_DKK, 10);
      expect(milk.denmark).toMatchObject({ seller: 'REMA 1000', currency: 'DKK', unitPrice: 13.5, unitPriceDkk: 13.5, kind: 'regular' });
      expect(milk.gap).toBeCloseTo(1 - ((16.9 / 1.5) * SEK_TO_DKK) / 13.5, 10);
    });

    it('counts a Willys regular price at the Willys Store of each Destination', () => {
      expect(item(data, 'hyllie', 'groceries', 'Whole milk').sweden!.seller).toBe('Willys Emporia');
      expect(item(data, 'vala', 'groceries', 'Whole milk').sweden!.seller).toBe('Willys Väla');
    });

    it('averages the item gaps of a Category without weighting', () => {
      const groceries = category(data, 'hyllie', 'groceries');
      const gaps = groceries.items.filter((i) => i.gap !== null).map((i) => i.gap!);
      expect(gaps.length).toBeGreaterThan(1);
      expect(groceries.priceGap).toBeCloseTo(gaps.reduce((a, b) => a + b, 0) / gaps.length, 10);
    });

    it('leaves out Basket Items not priced in both countries and reports them', () => {
      const all = data.priceGaps.flatMap((d) => d.categories);
      for (const c of all) {
        const unpriced = c.items.filter((i) => i.denmark === null || i.sweden === null).map((i) => i.name);
        expect(c.missingItems).toEqual(unpriced);
        for (const i of c.items) expect(i.gap === null).toBe(i.denmark === null || i.sweden === null);
      }
      // Pick-and-mix has no price in either country; at least one other item has a price on one side only.
      expect(category(data, 'hyllie', 'candy-snacks').missingItems).toContain('Pick-and-mix candy');
      const oneSided = all.flatMap((c) => c.items).filter((i) => (i.denmark === null) !== (i.sweden === null));
      expect(oneSided.length).toBeGreaterThan(0);
      // A one-sided item does not drag the mean towards 0.
      const groceries = category(data, 'hyllie', 'groceries');
      const priced = groceries.items.filter((i) => i.gap !== null);
      expect(priced.length).toBeLessThan(groceries.items.length);
      expect(groceries.priceGap).toBeCloseTo(priced.reduce((s, i) => s + i.gap!, 0) / priced.length, 10);
    });

    it('is the same at a Trip Date in another week while only regular prices exist', async () => {
      expect(category(await referenceData(db, '2027-01-02'), 'hyllie', 'groceries').priceGap).toBe(
        category(data, 'hyllie', 'groceries').priceGap,
      );
    });
  });

  describe('cheapest Store per Destination against the cheapest Danish Retailer', () => {
    beforeEach(async () => {
      await importFixtures(db);
      addObservations(db, [
        // Cheaper than REMA 1000's 13.50 DKK/l: Netto becomes the Danish price.
        extraObservation({ retailerId: 'netto', productId: 'netto-milk', productText: 'SØDMÆLK 3,5% | 1 LTR. / NETTO', price: 12, foundBy: ['sødmælk'] }),
        // City Gross has a Store at Hyllie only; Stora Coop at Väla only.
        extraObservation({ retailerId: 'city-gross', productId: 'cg-milk', productText: 'Standardmjölk 3% City Gross 1l', price: 9, foundBy: ['standardmjölk'] }),
        extraObservation({ retailerId: 'coop', productId: 'coop-milk', productText: 'Standardmjölk 3% Coop 1l', price: 20, foundBy: ['standardmjölk'] }),
      ]);
    });

    it('takes the cheapest Danish Retailer nationally and the cheapest Store at each Destination', async () => {
      const data = await referenceData(db);
      const hyllie = item(data, 'hyllie', 'groceries', 'Whole milk');
      const vala = item(data, 'vala', 'groceries', 'Whole milk');

      expect(hyllie.denmark!.seller).toBe('Netto');
      expect(vala.denmark!.seller).toBe('Netto');
      // City Gross Hyllie (9 SEK/l) beats Willys Emporia (11.27 SEK/l) at Hyllie ...
      expect(hyllie.sweden).toMatchObject({ seller: 'City Gross Hyllie', unitPrice: 9 });
      expect(hyllie.gap).toBeCloseTo(1 - (9 * SEK_TO_DKK) / 12, 10);
      // ... but does not count at Väla, where Stora Coop is dearer than Willys Väla.
      expect(vala.sweden!.seller).toBe('Willys Väla');
      expect(vala.gap).toBeCloseTo(1 - ((16.9 / 1.5) * SEK_TO_DKK) / 12, 10);
    });

    it('lets a Retailer cheapest at its own Destination win there', async () => {
      addObservations(db, [
        extraObservation({ retailerId: 'coop', productId: 'coop-milk', productText: 'Standardmjölk 3% Coop 1l', price: 5, foundBy: ['standardmjölk'] }),
      ]);
      const data = await referenceData(db);
      expect(item(data, 'vala', 'groceries', 'Whole milk').sweden).toMatchObject({ seller: 'Stora Coop Väla', unitPrice: 5 });
      expect(item(data, 'hyllie', 'groceries', 'Whole milk').sweden!.seller).toBe('City Gross Hyllie');
    });

    it('uses the most recent regular price of a product', async () => {
      addObservations(db, [
        extraObservation({ retailerId: 'city-gross', productId: 'cg-milk', productText: 'Standardmjölk 3% City Gross 1l', price: 30, foundBy: ['standardmjölk'] }),
      ]);
      const data = await referenceData(db);
      expect(item(data, 'hyllie', 'groceries', 'Whole milk').sweden!.seller).toBe('Willys Emporia');
    });

    it('gives a negative gap where Sweden is dearer than Denmark', async () => {
      addObservations(db, [
        extraObservation({ retailerId: 'netto', productId: 'netto-milk', productText: 'SØDMÆLK 3,5% | 1 LTR. / NETTO', price: 5, foundBy: ['sødmælk'] }),
      ]);
      const data = await referenceData(db);
      const milk = item(data, 'hyllie', 'groceries', 'Whole milk');
      expect(milk.gap).toBeLessThan(0);
      expect(milk.gap).toBeCloseTo(1 - (9 * SEK_TO_DKK) / 5, 10);
    });
  });

  describe('missing exchange rate', () => {
    it('cannot compare Swedish prices without a rate, so those items are left out', async () => {
      await importFixtures(db, ['willys', 'rema']);
      const data = await referenceData(db);
      expect(data.exchangeRate).toBeNull();
      const milk = item(data, 'hyllie', 'groceries', 'Whole milk');
      expect(milk.sweden).toBeNull();
      expect(milk.gap).toBeNull();
      expect(category(data, 'hyllie', 'groceries').priceGap).toBeNull();
    });
  });
});
