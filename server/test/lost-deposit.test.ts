import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ReferenceData } from '@shop-in-sweden/shared';
import { createApp } from '../src/app';
import { openDatabase, type Db } from '../src/db/connection';
import { runImport } from '../src/import/run-import';
import { buildMatchReport, formatMatchReport } from '../src/match/match-report';
import { recordImportRun, type ObservationDraft } from '../src/prices/store';
import { seedDatabase } from '../src/seed';
import { noLeaflets, recordedTjek, replayTjek, tjekOffer, type TjekData } from './tjek-fake';

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string) => readFileSync(resolve(fixtureDir, name), 'utf8');
const willysSearches = JSON.parse(fixture('willys-search.json')) as Record<string, unknown>;
const remaPage = fixture('rema-products.json');
const ecbCsv = fixture('ecb-exr.csv');

const NOW = new Date('2026-10-08T10:00:00Z');
const TRIP_DATE = '2026-10-10';
const SEK_TO_DKK = 7.4745 / 11.224;
const WILLYS_EMPORIA = '17K26VB5';

function network(tjek: TjekData): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname.includes('tjek')) return replayTjek(url, tjek);
    if (url.hostname.includes('willys')) {
      return Response.json(
        willysSearches[url.searchParams.get('q') ?? ''] ?? { results: [], pagination: { pageSize: 100, currentPage: 0, numberOfPages: 1, totalNumberOfResults: 0 } },
      );
    }
    if (url.hostname.includes('rema1000')) return new Response(remaPage, { headers: { 'content-type': 'application/json' } });
    return new Response(ecbCsv);
  }) as typeof fetch;
}

const importAll = (db: Db, tjek: TjekData) => runImport(db, { fetch: network(tjek), now: () => NOW, delayMs: 0, tripDate: TRIP_DATE });

function observation(o: Partial<ObservationDraft> & Pick<ObservationDraft, 'retailerId' | 'productId' | 'productText' | 'price'>): ObservationDraft {
  return { source: 'test', foundBy: [], currency: o.retailerId === 'netto' ? 'DKK' : 'SEK', quantity: { pieces: 1, size: 1, unit: 'l' }, kind: 'regular', validFrom: '2026-10-08', ...o };
}

const addObservations = (db: Db, observations: ObservationDraft[]) => recordImportRun(db, { source: 'test', startedAt: NOW, finishedAt: NOW, observations });

async function item(db: Db, categoryId: string, name: string) {
  const res = await createApp(db).request(`/api/reference-data?dato=${TRIP_DATE}`);
  expect(res.status).toBe(200);
  const data = (await res.json()) as ReferenceData;
  const found = data.priceGaps.find((d) => d.destinationId === 'hyllie')!.categories.find((c) => c.categoryId === categoryId)!.items.find((i) => i.name === name);
  expect(found, name).toBeDefined();
  return found!;
}

// Danish prices for the two soft-drink Basket Items; the Danish side carries no deposit.
const danishCans = observation({ retailerId: 'netto', productId: 'netto-cola-cans', productText: 'Cola dåse 24 x 33 cl', price: 120, foundBy: ['cola dåse'], quantity: { pieces: 24, size: 33, unit: 'cl' } });
const danishBottle = observation({ retailerId: 'netto', productId: 'netto-cola-1-5', productText: 'Cola 1,5 L', price: 15, foundBy: ['cola 1,5 l'], quantity: { pieces: 1, size: 1.5, unit: 'l' } });

describe('Lost Deposit on Swedish soft drinks', () => {
  let db: Db;

  beforeEach(() => {
    db = openDatabase(':memory:');
    seedDatabase(db);
  });

  describe('Willys regular prices', () => {
    beforeEach(async () => {
      await importAll(db, noLeaflets);
      addObservations(db, [
        danishCans,
        danishBottle,
        observation({ retailerId: 'willys', productId: 'cola-1-5', productText: 'Coca-Cola Läsk PET | COCA-COLA, 1,5l', foundBy: ['cola 1,5 l'], price: 18, quantity: { pieces: 1, size: 1.5, unit: 'l' } }),
      ]);
    });

    it('adds the deposit Willys reports for a multipack of cans to the price before the Unit Price', async () => {
      const cans = await item(db, 'soft-drinks', 'Cola cans');
      // 15 x 33 cl for 99.90 SEK plus 30 SEK stored deposit: 129.90 SEK for 4.95 l.
      expect(cans.sweden).toMatchObject({ lostDeposit: 30, currency: 'SEK', per: 'l', kind: 'regular' });
      expect(cans.sweden!.unitPrice).toBeCloseTo(129.9 / 4.95, 10);
      expect(cans.sweden!.unitPriceDkk).toBeCloseTo((129.9 / 4.95) * SEK_TO_DKK, 10);
    });

    it('compares Danish prices without deposit', async () => {
      const cans = await item(db, 'soft-drinks', 'Cola cans');
      expect(cans.denmark).toMatchObject({ lostDeposit: 0, currency: 'DKK' });
      // REMA 1000's 50 cl can, 4.08 DKK: no deposit added on the Danish side.
      expect(cans.denmark!.unitPrice).toBeCloseTo(4.08 / 0.5, 10);
      expect(cans.gap).toBeCloseTo(1 - ((129.9 / 4.95) * SEK_TO_DKK) / (4.08 / 0.5), 10);
    });

    it('derives 3 SEK for a large bottle that reports no deposit', async () => {
      const bottle = await item(db, 'soft-drinks', 'Cola 1.5 L');
      expect(bottle.sweden).toMatchObject({ lostDeposit: 3 });
      expect(bottle.sweden!.unitPrice).toBeCloseTo(21 / 1.5, 10);
      // The Danish side is compared as it is, without deposit.
      expect(bottle.gap).toBeCloseTo(1 - ((21 / 1.5) * SEK_TO_DKK) / bottle.denmark!.unitPriceDkk, 10);
    });

    it('prefers the stored deposit over a derived one', async () => {
      addObservations(db, [
        observation({ retailerId: 'willys', productId: 'cola-1-5', productText: 'Coca-Cola Läsk PET | COCA-COLA, 1,5l', foundBy: ['cola 1,5 l'], price: 18, deposit: 4, quantity: { pieces: 1, size: 1.5, unit: 'l' } }),
      ]);
      expect((await item(db, 'soft-drinks', 'Cola 1.5 L')).sweden).toMatchObject({ lostDeposit: 4 });
    });

    it('derives 2 SEK per small container and leaves cartons and other Categories alone', async () => {
      addObservations(db, [
        observation({ retailerId: 'willys', productId: 'water-6', productText: 'Kolsyrat vatten 6 x 50cl', foundBy: ['kolsyrat vatten'], price: 30, quantity: { pieces: 6, size: 50, unit: 'cl' } }),
        observation({ retailerId: 'willys', productId: 'oj', productText: 'Apelsinjuice 1l', foundBy: ['apelsinjuice'], price: 20 }),
        observation({ retailerId: 'netto', productId: 'netto-water', productText: 'Danskvand 6 x 50 cl', foundBy: ['danskvand'], price: 30, quantity: { pieces: 6, size: 50, unit: 'cl' } }),
      ]);
      const water = await item(db, 'soft-drinks', 'Sparkling water');
      expect(water.sweden).toMatchObject({ lostDeposit: 12 });
      expect(water.sweden!.unitPrice).toBeCloseTo(42 / 3, 10);
      expect(water.denmark).toMatchObject({ lostDeposit: 0 });
      expect((await item(db, 'soft-drinks', 'Orange juice')).sweden).toMatchObject({ lostDeposit: 0, unitPrice: 20 });
      expect((await item(db, 'groceries', 'Whole milk')).sweden).toMatchObject({ lostDeposit: 0 });
    });

    it('shows the Lost Deposit in the match report', () => {
      const text = formatMatchReport(buildMatchReport(db, TRIP_DATE));
      expect(text).toContain('99.90 SEK + 30.00 SEK Lost Deposit = 129.90 SEK for 15 x 33 cl');
    });
  });

  describe('Offers from Tjek', () => {
    const leaflet = (offers: Record<string, unknown>[]): TjekData => ({ ...recordedTjek, offers: { [WILLYS_EMPORIA]: offers } });

    it('derives the deposit of a multipack of cans from pieces and size', async () => {
      await importAll(
        db,
        leaflet([tjekOffer({ id: 'cans', heading: 'COCA COLA 15-PACK', description: 'Olika sorter\n+pant', price: 79.9, unit: 'cl', size: 33, pieces: 15 })]),
      );
      addObservations(db, [danishCans]);
      const cans = await item(db, 'soft-drinks', 'Cola cans');
      expect(cans.sweden).toMatchObject({ kind: 'offer', lostDeposit: 30, seller: 'Willys Emporia' });
      expect(cans.sweden!.unitPrice).toBeCloseTo(109.9 / 4.95, 10);
      expect(cans.denmark).toMatchObject({ lostDeposit: 0 });
    });

    it('derives 3 SEK for a large bottle', async () => {
      await importAll(db, leaflet([tjekOffer({ id: 'bottle', heading: 'Coca-Cola 1,5 l', description: 'Pant tillkommer', price: 12, unit: 'l', size: 1.5 })]));
      addObservations(db, [danishBottle]);
      const bottle = await item(db, 'soft-drinks', 'Cola 1.5 L');
      expect(bottle.sweden).toMatchObject({ kind: 'offer', lostDeposit: 3 });
      expect(bottle.sweden!.unitPrice).toBeCloseTo(15 / 1.5, 10);
      expect(formatMatchReport(buildMatchReport(db, TRIP_DATE))).toContain('12.00 SEK + 3.00 SEK Lost Deposit = 15.00 SEK for 1.5 l');
    });
  });
});
