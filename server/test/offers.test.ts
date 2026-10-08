import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ReferenceData } from '@shop-in-sweden/shared';
import { createApp } from '../src/app';
import { openDatabase, type Db } from '../src/db/connection';
import { localDate, nextSaturday } from '../src/dates';
import { runImport } from '../src/import/run-import';
import { buildMatchReport, formatMatchReport } from '../src/match/match-report';
import { listPriceObservations } from '../src/prices/store';
import { seedDatabase } from '../src/seed';
import { chooseStoreCatalogs, isMemberOnly, offerQuantity, offerText } from '../src/sources/tjek';
import { recordedTjek, replayTjek, tjekOffer, type TjekData } from './tjek-fake';

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string) => readFileSync(resolve(fixtureDir, name), 'utf8');
const willysSearches = JSON.parse(fixture('willys-search.json')) as Record<string, unknown>;
const remaPage = fixture('rema-products.json');
const ecbCsv = fixture('ecb-exr.csv');

const NOW = new Date('2026-10-08T10:00:00Z');
const TRIP_DATE = '2026-10-10';
const SEK_TO_DKK = 7.4745 / 11.224;

// Catalog ids in the recording.
const WILLYS_EMPORIA = '17K26VB5';
const WILLYS_VALA = 'ST0IWh9J';
const COOP_VALA_THIS_WEEK = 'Qs_kATy1';
const NETTO_WEEK_42 = '0lfB7rI1';
const NETTO_WEEK_41 = 'VRknURDg';

/** Regular prices as recorded; Tjek serves `tjek`, so a test controls exactly which Offers exist. */
function network(tjek: TjekData, requests: string[] = []): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    requests.push(url.href);
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

const leaflets = (offers: Record<string, Record<string, unknown>[]>): TjekData => ({ ...recordedTjek, offers });

function importAll(db: Db, tjek: TjekData, requests?: string[]) {
  return runImport(db, { fetch: network(tjek, requests), now: () => NOW, delayMs: 0, tripDate: TRIP_DATE });
}

async function referenceData(db: Db, tripDate = TRIP_DATE): Promise<ReferenceData> {
  const res = await createApp(db).request(`/api/reference-data?dato=${tripDate}`);
  expect(res.status).toBe(200);
  return (await res.json()) as ReferenceData;
}

function milk(data: ReferenceData, destinationId: string) {
  const found = data.priceGaps
    .find((d) => d.destinationId === destinationId)!
    .categories.find((c) => c.categoryId === 'groceries')!
    .items.find((i) => i.name === 'Whole milk')!;
  return found;
}

// Regular prices: Willys 16.90 SEK for 1.5 l (11.27 SEK/l) at both Willys Stores, REMA 1000 13.50 DKK/l.
const REGULAR_SEK_PER_L = 16.9 / 1.5;

const milkOffer = (id: string, price: number, extra: Partial<Parameters<typeof tjekOffer>[0]> = {}) =>
  tjekOffer({ id, heading: 'Standardmjölk 3%', description: 'Arla. Jfr pris 8:00/l.', price, unit: 'l', size: 1, ...extra });

describe('Offers from Tjek in the Price Gaps', () => {
  let db: Db;

  beforeEach(() => {
    db = openDatabase(':memory:');
    seedDatabase(db);
  });

  it('prices a Basket Item at an Offer that beats the regular price, and says until when it is valid', async () => {
    await importAll(db, leaflets({ [WILLYS_EMPORIA]: [milkOffer('milk-1', 8)] }));
    const data = await referenceData(db);

    expect(milk(data, 'hyllie').sweden).toMatchObject({
      seller: 'Willys Emporia',
      kind: 'offer',
      validTo: '2026-10-11',
      unitPrice: 8,
      currency: 'SEK',
      per: 'l',
    });
    expect(milk(data, 'hyllie').sweden!.unitPriceDkk).toBeCloseTo(8 * SEK_TO_DKK, 10);
    expect(milk(data, 'hyllie').gap).toBeCloseTo(1 - (8 * SEK_TO_DKK) / 13.5, 10);
    // The Offer is tied to Willys Emporia: Willys Väla stays at its regular price.
    expect(milk(data, 'vala').sweden).toMatchObject({ seller: 'Willys Väla', kind: 'regular', unitPrice: REGULAR_SEK_PER_L });
  });

  it('keeps the regular price when the Offer is dearer', async () => {
    await importAll(db, leaflets({ [WILLYS_EMPORIA]: [milkOffer('milk-1', 15)] }));
    expect(milk(await referenceData(db), 'hyllie').sweden).toMatchObject({ kind: 'regular', unitPrice: REGULAR_SEK_PER_L });
  });

  describe('validity against the Trip Date, in local time', () => {
    it('ignores an expired Offer', async () => {
      // Ran 28 September to 4 October local time.
      await importAll(db, leaflets({ [WILLYS_EMPORIA]: [milkOffer('old', 5, { from: '2026-09-27T22:00:00+0000', till: '2026-10-04T21:59:59+0000' })] }));
      const stored = listPriceObservations(db, { source: 'tjek' });
      expect(stored.find((o) => o.productId === 'old')).toMatchObject({ validFrom: '2026-09-28', validTo: '2026-10-04' });
      expect(milk(await referenceData(db), 'hyllie').sweden).toMatchObject({ kind: 'regular' });
    });

    it('ignores an Offer that has not started yet, and counts it from its first day', async () => {
      // Runs 12-18 October local time.
      await importAll(db, leaflets({ [WILLYS_EMPORIA]: [milkOffer('next', 5, { from: '2026-10-11T22:00:00+0000', till: '2026-10-18T21:59:59+0000' })] }));
      expect(milk(await referenceData(db, '2026-10-10'), 'hyllie').sweden).toMatchObject({ kind: 'regular' });
      expect(milk(await referenceData(db, '2026-10-11'), 'hyllie').sweden).toMatchObject({ kind: 'regular' });
      expect(milk(await referenceData(db, '2026-10-12'), 'hyllie').sweden).toMatchObject({ kind: 'offer', unitPrice: 5, validTo: '2026-10-18' });
    });

    it('counts an Offer on its first and last local day, not the days around it', async () => {
      // 22:00Z on 9 October is 00:00 on 10 October in Denmark and Sweden; 21:59:59Z on 10 October is the end of that day.
      await importAll(db, leaflets({ [WILLYS_EMPORIA]: [milkOffer('one-day', 5, { from: '2026-10-09T22:00:00+0000', till: '2026-10-10T21:59:59+0000' })] }));
      expect(milk(await referenceData(db, '2026-10-09'), 'hyllie').sweden).toMatchObject({ kind: 'regular' });
      expect(milk(await referenceData(db, '2026-10-10'), 'hyllie').sweden).toMatchObject({ kind: 'offer', validTo: '2026-10-10' });
      expect(milk(await referenceData(db, '2026-10-11'), 'hyllie').sweden).toMatchObject({ kind: 'regular' });
    });

    it('gives the regular-price gap on a Trip Date after every Offer has ended', async () => {
      await importAll(db, leaflets({ [WILLYS_EMPORIA]: [milkOffer('milk-1', 5)], [NETTO_WEEK_42]: [] }));
      const withOffers = milk(await referenceData(db, TRIP_DATE), 'hyllie');
      const later = milk(await referenceData(db, '2027-03-06'), 'hyllie');
      expect(withOffers.sweden!.kind).toBe('offer');
      expect(later.sweden!.kind).toBe('regular');
      expect(later.gap).toBeCloseTo(1 - (REGULAR_SEK_PER_L * SEK_TO_DKK) / 13.5, 10);
    });

    it('uses the newest import of an Offer, so a corrected price replaces the earlier one', async () => {
      await importAll(db, leaflets({ [WILLYS_EMPORIA]: [milkOffer('milk-1', 5)] }));
      await importAll(db, leaflets({ [WILLYS_EMPORIA]: [milkOffer('milk-1', 9)] }));
      expect(milk(await referenceData(db), 'hyllie').sweden).toMatchObject({ kind: 'offer', unitPrice: 9 });
    });
  });

  describe('member-only Offers', () => {
    const willysPlus = milkOffer('plus', 4, { description: 'Arla. Max 3 köp/hushåll\nFör dig med WillysPlus' });
    const coopMember = milkOffer('coop', 3, { heading: 'Standardmjölk 3%', description: 'MEDLEMSPRIS Arla.' });

    it('stores them flagged, never uses them, and reports the rejection', async () => {
      const { output } = await importAll(db, leaflets({ [WILLYS_EMPORIA]: [willysPlus], [COOP_VALA_THIS_WEEK]: [coopMember] }));

      const stored = listPriceObservations(db, { source: 'tjek' });
      expect(stored.find((o) => o.productId === 'plus')).toMatchObject({ memberOnly: true, retailerId: 'willys', storeId: 'willys-emporia', kind: 'offer' });
      expect(stored.find((o) => o.productId === 'coop')).toMatchObject({ memberOnly: true, retailerId: 'coop', storeId: 'stora-coop-vala' });

      const data = await referenceData(db);
      expect(milk(data, 'hyllie').sweden).toMatchObject({ kind: 'regular', seller: 'Willys Emporia' });
      expect(milk(data, 'vala').sweden).toMatchObject({ kind: 'regular', seller: 'Willys Väla' });

      expect(output).toContain('rejected Willys: Standardmjölk 3% | Arla. Max 3 köp/hushåll För dig med WillysPlus (4.00 SEK): member-only Offer');
      expect(output).toMatch(/rejected Stora Coop: .*\(3\.00 SEK\): member-only Offer/);
    });

    it('does not flag an ordinary Offer', async () => {
      await importAll(db, leaflets({ [WILLYS_EMPORIA]: [milkOffer('plain', 8)] }));
      expect(listPriceObservations(db, { source: 'tjek' }).find((o) => o.productId === 'plain')!.memberOnly).toBe(false);
    });

    it('uses the Danish phrases for the Danish Retailers', async () => {
      const app = tjekDanishMilk('Gælder kun med Netto+ appen');
      await importAll(db, leaflets({ [NETTO_WEEK_42]: [app] }));
      expect(listPriceObservations(db, { source: 'tjek' }).find((o) => o.productId === 'dk-milk')!.memberOnly).toBe(true);
      expect(milk(await referenceData(db), 'hyllie').denmark).toMatchObject({ seller: 'REMA 1000', kind: 'regular' });
    });
  });

  describe('multi-buys and multipacks', () => {
    it('prices "2 för 14 kr" per litre from pieces x size', async () => {
      await importAll(db, leaflets({ [WILLYS_EMPORIA]: [milkOffer('2for', 14, { pieces: 2 }), milkOffer('single', 8)] }));
      const data = await referenceData(db);
      expect(milk(data, 'hyllie').sweden).toMatchObject({ kind: 'offer', unitPrice: 7, per: 'l' });
      expect(listPriceObservations(db, { source: 'tjek' }).find((o) => o.productId === '2for')!.quantity).toEqual({ pieces: 2, size: 1, unit: 'l' });
    });

    it('converts the unit factor: 2 x 500 ml for 12 kr is 12 kr per litre', async () => {
      await importAll(db, leaflets({ [WILLYS_EMPORIA]: [milkOffer('half', 12, { unit: 'ml', size: 500, pieces: 2 })] }));
      // Two 500 ml packs are 1 litre in total, which is inside the Match Rule's 0.9-2.1 l.
      expect(milk(await referenceData(db), 'hyllie').sweden).toMatchObject({ kind: 'regular' });
      await importAll(db, leaflets({ [WILLYS_EMPORIA]: [milkOffer('half', 9, { unit: 'ml', size: 500, pieces: 2 })] }));
      expect(milk(await referenceData(db), 'hyllie').sweden).toMatchObject({ kind: 'offer', unitPrice: 9 });
    });
  });

  describe('Stores and Destinations', () => {
    it('does not count an Offer from a Store outside the Destination', async () => {
      // Cheap milk at Willys Väla (the Väla Destination) only.
      await importAll(db, leaflets({ [WILLYS_VALA]: [milkOffer('vala-only', 4)] }));
      const data = await referenceData(db);
      expect(milk(data, 'vala').sweden).toMatchObject({ kind: 'offer', seller: 'Willys Väla', unitPrice: 4 });
      expect(milk(data, 'hyllie').sweden).toMatchObject({ kind: 'regular', seller: 'Willys Emporia' });
    });

    it('counts an Offer only at the Store whose leaflet it is in', async () => {
      await importAll(db, leaflets({ [WILLYS_EMPORIA]: [milkOffer('e', 4)] }));
      const stored = listPriceObservations(db, { source: 'tjek' }).filter((o) => o.productId === 'e');
      expect(stored.map((o) => o.storeId)).toEqual(['willys-emporia']);
    });

    it('stores a national leaflet once per Store of the Retailer, with the Store', async () => {
      const lidl = tjekOffer({ id: 'lidl-1', heading: 'Standardmjölk 3%', price: 9, unit: 'l', size: 1 });
      await importAll(db, leaflets({ Hstu0DYp: [lidl] }));
      const stored = listPriceObservations(db, { source: 'tjek' }).filter((o) => o.productId === 'lidl-1');
      expect(stored.map((o) => o.storeId).sort()).toEqual(['lidl-delsjogatan', 'lidl-drottninghogsvagen']);
      const data = await referenceData(db);
      expect(milk(data, 'hyllie').sweden).toMatchObject({ seller: 'Lidl Delsjögatan', kind: 'offer', unitPrice: 9 });
      expect(milk(data, 'vala').sweden).toMatchObject({ seller: 'Lidl Drottninghögsvägen', kind: 'offer', unitPrice: 9 });
    });
  });

  describe('Danish Offers', () => {
    it('counts a Danish Offer nationally and lowers the Danish price', async () => {
      await importAll(db, leaflets({ [NETTO_WEEK_42]: [tjekDanishMilk('')] }));
      const stored = listPriceObservations(db, { source: 'tjek' }).find((o) => o.productId === 'dk-milk')!;
      expect(stored).toMatchObject({ retailerId: 'netto', storeId: null, currency: 'DKK', validFrom: '2026-10-10', validTo: '2026-10-16' });
      const data = await referenceData(db);
      for (const destination of ['hyllie', 'vala']) {
        expect(milk(data, destination).denmark).toMatchObject({ seller: 'Netto', kind: 'offer', unitPrice: 10, validTo: '2026-10-16' });
      }
    });

    it('ignores a Danish Offer from last week', async () => {
      await importAll(db, leaflets({ [NETTO_WEEK_41]: [{ ...tjekDanishMilk(''), run_from: '2026-10-01T22:00:00+0000', run_till: '2026-10-09T21:59:59+0000' }] }));
      expect(milk(await referenceData(db), 'hyllie').denmark).toMatchObject({ seller: 'REMA 1000', kind: 'regular' });
    });
  });

  it('shows Offers picked and rejected in the match report, with the Trip Date', async () => {
    const { output } = await importAll(db, leaflets({
      [WILLYS_EMPORIA]: [milkOffer('good', 8), milkOffer('plus', 4, { description: 'För dig med WillysPlus' }), milkOffer('old', 3, { from: '2026-09-27T22:00:00+0000', till: '2026-10-04T21:59:59+0000' })],
    }));
    expect(output).toContain('Trip Date: 2026-10-10');
    expect(output).toContain('Sweden: PICKED Willys: Standardmjölk 3% | Arla. Jfr pris 8:00/l. [Offer, valid until 2026-10-11]');
    expect(output).toContain('(4.00 SEK): member-only Offer');
    expect(output).toContain('(3.00 SEK): Offer valid 2026-09-28 to 2026-10-04, not on Trip Date 2026-10-10');
    // The report for another Trip Date is built from the same stored Offers.
    const later = formatMatchReport(buildMatchReport(db, '2026-10-14'));
    expect(later).toContain('Trip Date: 2026-10-14');
    expect(later).not.toContain('[Offer, valid until 2026-10-11]');
  });
});

function tjekDanishMilk(description: string) {
  return tjekOffer({ id: 'dk-milk', heading: 'Sødmælk', description, price: 10, unit: 'l', size: 1, currency: 'DKK', from: '2026-10-09T22:00:00+0000', till: '2026-10-16T21:59:59+0000' });
}

describe('Tjek importer', () => {
  let db: Db;

  beforeEach(() => {
    db = openDatabase(':memory:');
    seedDatabase(db);
  });

  it('stores the recorded leaflets: Swedish Offers per Store, Danish Offers per Retailer', async () => {
    const { runs } = await runImport(db, { sources: ['tjek'], fetch: network(recordedTjek), now: () => NOW, delayMs: 0, tripDate: TRIP_DATE });
    expect(runs).toMatchObject([{ source: 'tjek', outcome: 'success' }]);

    const offers = listPriceObservations(db, { source: 'tjek' });
    expect(offers.length).toBe(runs[0]!.observationCount);
    expect(offers.every((o) => o.kind === 'offer')).toBe(true);

    const swedishStores = new Set(offers.filter((o) => o.currency === 'SEK').map((o) => o.storeId));
    expect(swedishStores).toEqual(new Set(['willys-emporia', 'city-gross-hyllie', 'lidl-delsjogatan', 'willys-vala', 'stora-coop-vala', 'lidl-drottninghogsvagen']));
    const danish = offers.filter((o) => o.currency === 'DKK');
    expect(new Set(danish.map((o) => o.retailerId))).toEqual(new Set(['rema1000', 'netto', 'lidl-dk', 'foetex', 'bilka']));
    expect(danish.every((o) => o.storeId === null)).toBe(true);

    // Every Offer keeps its heading and description, price, quantity and validity dates.
    const sample = offers.find((o) => o.retailerId === 'willys' && o.quantity)!;
    expect(sample.productText).toContain(' | ');
    expect(sample).toMatchObject({ source: 'tjek', currency: 'SEK', validFrom: '2026-10-05', validTo: '2026-10-11' });
    expect(sample.price).toBeGreaterThan(0);
    // Coop's Väla leaflet for next week is stored too, so a later Trip Date finds it.
    expect(offers.some((o) => o.retailerId === 'coop' && o.validFrom === '2026-10-12')).toBe(true);
  });

  it('flags the recorded member-only Offers of every Retailer with member phrases', async () => {
    await runImport(db, { sources: ['tjek'], fetch: network(recordedTjek), now: () => NOW, delayMs: 0, tripDate: TRIP_DATE });
    const offers = listPriceObservations(db, { source: 'tjek' });
    const flagged = (retailerId: string) => offers.filter((o) => o.retailerId === retailerId && o.memberOnly);
    for (const retailerId of ['willys', 'lidl-se', 'city-gross', 'coop', 'lidl-dk', 'netto', 'foetex', 'bilka']) {
      expect(flagged(retailerId).length, retailerId).toBeGreaterThan(0);
    }
    expect(flagged('willys').every((o) => /willysplus/i.test(o.productText))).toBe(true);
  });

  it('asks for Swedish Stores with Swedish coordinates and Danish Retailers with Copenhagen coordinates, one request at a time', async () => {
    const requests: string[] = [];
    await runImport(db, { sources: ['tjek'], fetch: network(recordedTjek, requests), now: () => NOW, delayMs: 0, tripDate: TRIP_DATE });
    const catalogQueries = requests.map((u) => new URL(u)).filter((u) => u.pathname === '/v2/catalogs');
    const swedish = catalogQueries.filter((u) => ['c371GA', '6c28SD', '03a7b3', 'bfe5hA'].includes(u.searchParams.get('dealer_ids')!));
    expect(swedish.length).toBeGreaterThan(0);
    expect(swedish.every((u) => Number(u.searchParams.get('r_lat')) < 56.2 && Number(u.searchParams.get('r_lng')) > 12.7)).toBe(true);
    const danish = catalogQueries.filter((u) => ['11deC', '9ba51', '71c90', 'bdf5A', '93f13'].includes(u.searchParams.get('dealer_ids')!));
    expect(danish.map((u) => u.searchParams.get('dealer_ids'))).toEqual(['11deC', '9ba51', '71c90', 'bdf5A', '93f13']);
    expect(danish.every((u) => u.searchParams.get('r_lat') === '55.676' && u.searchParams.get('r_lng') === '12.568')).toBe(true);
    // The national Lidl leaflet is read once although two Stores use it.
    expect(requests.filter((u) => u.includes('catalog_id=Hstu0DYp')).length).toBe(1);
  });

  it('pages through a catalog 100 Offers at a time', async () => {
    const many = Array.from({ length: 250 }, (_, i) => tjekOffer({ id: `o${i}`, heading: `Vara ${i}`, price: 10 + i }));
    const requests: string[] = [];
    await runImport(db, { sources: ['tjek'], fetch: network(leaflets({ [WILLYS_EMPORIA]: many }), requests), now: () => NOW, delayMs: 0, tripDate: TRIP_DATE });
    const pages = requests.map((u) => new URL(u)).filter((u) => u.searchParams.get('catalog_id') === WILLYS_EMPORIA);
    expect(pages.map((u) => [u.searchParams.get('limit'), u.searchParams.get('offset')])).toEqual([['100', '0'], ['100', '100'], ['100', '200']]);
    expect(listPriceObservations(db, { source: 'tjek' }).filter((o) => o.storeId === 'willys-emporia')).toHaveLength(250);
  });

  it('skips Offers it cannot price and leaves out catalogs that have ended', async () => {
    const tjek: TjekData = {
      ...recordedTjek,
      catalogs: [
        ...recordedTjek.catalogs,
        { id: 'ended', label: 'Willys Malmö Emporia', run_from: '2026-09-20T22:00:00+0000', run_till: '2026-09-27T21:59:59+0000', offer_count: 5, dealer_id: 'c371GA', _region: 'hyllie' },
      ],
      offers: {
        [WILLYS_EMPORIA]: [tjekOffer({ id: 'free', heading: 'Gratis', price: 0 }), tjekOffer({ id: 'ok', heading: 'Vara', price: 5 })],
        ended: [tjekOffer({ id: 'stale', heading: 'Gammal vara', price: 5 })],
      },
    };
    await runImport(db, { sources: ['tjek'], fetch: network(tjek), now: () => NOW, delayMs: 0, tripDate: TRIP_DATE });
    expect(listPriceObservations(db, { source: 'tjek' }).map((o) => o.productId).sort()).toEqual(['ok']);
  });

  it('fails when Tjek answers something unexpected', async () => {
    const broken = (async () => Response.json({ unexpected: true })) as unknown as typeof fetch;
    const { runs, ok } = await runImport(db, { sources: ['tjek'], fetch: broken, now: () => NOW, delayMs: 0, tripDate: TRIP_DATE });
    expect(ok).toBe(false);
    expect(runs[0]!.error).toContain('Unexpected Tjek');
  });
});

describe('reading an Offer', () => {
  const offer = (symbol: string, size: [number, number], pieces: [number, number] = [1, 1]) => ({
    id: 'x',
    quantity: { unit: { symbol }, size: { from: size[0], to: size[1] }, pieces: { from: pieces[0], to: pieces[1] } },
  });

  it('takes pieces x size x unit', () => {
    expect(offerQuantity(offer('cl', [33, 33], [15, 15]))).toEqual({ pieces: 15, size: 33, unit: 'cl' });
    expect(offerQuantity(offer('pcs', [10, 10], [2, 2]))).toEqual({ pieces: 2, size: 10, unit: 'pcs' });
  });

  it('gives a size range no quantity instead of guessing a size', () => {
    expect(offerQuantity(offer('g', [7.5, 500]))).toBeNull();
    expect(offerQuantity(offer('g', [400, 500]))).toBeNull();
    expect(offerQuantity(offer('g', [200, 200], [1, 3]))).toBeNull();
  });

  it('gives units it does not know and missing sizes no quantity', () => {
    expect(offerQuantity(offer('m', [3, 3]))).toBeNull();
    expect(offerQuantity({ id: 'x', quantity: null })).toBeNull();
    expect(offerQuantity({ id: 'x', quantity: { unit: { symbol: 'kg' }, size: null } })).toBeNull();
  });

  it('puts heading and description in the text and drops "gäller ej" exceptions', () => {
    expect(offerText({ id: 'x', heading: 'Smör', description: 'Arla. 500 g.\nGäller ej ekologiskt, laktosfritt. Jfr pris 75,90/kg.' })).toBe('Smör | Arla. 500 g. Jfr pris 75,90/kg.');
    expect(offerText({ id: 'x', heading: 'Ägg', description: '' })).toBe('Ägg');
  });

  it('recognises member phrases case-insensitively', () => {
    expect(isMemberOnly({ id: 'x', heading: 'Mjölk', description: 'för dig med willysplus' }, ['För dig med WillysPlus'])).toBe(true);
    expect(isMemberOnly({ id: 'x', heading: 'Medlemspris', description: '' }, ['Medlemspris'])).toBe(true);
    expect(isMemberOnly({ id: 'x', heading: 'Mjölk', description: 'Stammis-pris' }, [])).toBe(true);
    expect(isMemberOnly({ id: 'x', heading: 'Mjölk', description: 'Arla' }, ['Lidl Plus'])).toBe(false);
  });

  it('chooses the leaflet named after the Tjek store, else the national leaflets', () => {
    const c = (id: string, label: string) => ({ id, label, run_from: '', run_till: '' });
    const catalogs = [c('a', 'Willys Malmö Emporia'), c('b', 'Willys Hemma Söderkulla'), c('c', 'Vecka 41')];
    expect(chooseStoreCatalogs(catalogs, 'Willys Malmö Emporia', 'Willys').map((x) => x.id)).toEqual(['a']);
    expect(chooseStoreCatalogs(catalogs, 'H-borg Drottninghög', 'Lidl').map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(chooseStoreCatalogs(catalogs, 'H-borg Drottninghög', 'Willys').map((x) => x.id)).toEqual(['c']);
  });
});

describe('local dates', () => {
  it('reads Tjek UTC times as Danish and Swedish local dates', () => {
    expect(localDate(new Date('2026-10-04T22:00:00Z'))).toBe('2026-10-05');
    expect(localDate(new Date('2026-10-11T21:59:59Z'))).toBe('2026-10-11');
    expect(localDate(new Date('2027-01-09T22:59:59Z'))).toBe('2027-01-09');
    expect(localDate(new Date('2027-01-09T23:00:00Z'))).toBe('2027-01-10');
  });

  it('finds the coming Saturday', () => {
    expect(nextSaturday(new Date('2026-10-08T10:00:00Z'))).toBe('2026-10-10');
    expect(nextSaturday(new Date('2026-10-10T10:00:00Z'))).toBe('2026-10-10');
    expect(nextSaturday(new Date('2026-10-11T10:00:00Z'))).toBe('2026-10-17');
  });
});
