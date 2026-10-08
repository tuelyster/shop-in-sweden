import { beforeAll, describe, expect, it } from 'vitest';
import { calculateTrips, type ReferenceData } from '@shop-in-sweden/shared';
import { createApp } from '../src/app';
import { openDatabase } from '../src/db/connection';
import { recordImportRun } from '../src/prices/store';
import { seedDatabase } from '../src/seed';

describe('GET /api/reference-data', () => {
  let app: ReturnType<typeof createApp>;

  async function fetchFor(tripDate: string): Promise<ReferenceData> {
    const res = await app.request(`/api/reference-data?dato=${tripDate}`);
    expect(res.status).toBe(200);
    return (await res.json()) as ReferenceData;
  }

  beforeAll(() => {
    const db = openDatabase(':memory:');
    seedDatabase(db);
    app = createApp(db);
  });

  it('returns both Crossings with their Destinations', async () => {
    const body = await fetchFor('2026-11-14');
    expect(body.crossings.map((c) => [c.id, c.destination.id])).toEqual([
      ['bridge', 'hyllie'],
      ['ferry', 'vala'],
    ]);
  });

  it('returns the high season as data', async () => {
    const body = await fetchFor('2026-11-14');
    expect(body.seasons).toEqual([
      expect.objectContaining({ id: 'high', startMonthDay: '06-01', endMonthDay: '08-31' }),
    ]);
  });

  it('returns every Crossing Fee with agreement, valid-from date and source', async () => {
    const body = await fetchFor('2026-11-14');
    const bridge = body.crossings.find((c) => c.id === 'bridge')!;
    const ferry = body.crossings.find((c) => c.id === 'ferry')!;
    const summary = (fees: typeof bridge.fees) =>
      fees.map((f) => [f.agreement, f.kind, f.season, f.bracket, f.priceDkk]);
    expect(summary(bridge.fees)).toEqual([
      ['none', 'single', null, null, 420],
      ['oresundgo', 'single', null, null, 182],
    ]);
    expect(summary(ferry.fees)).toEqual([
      ['none', 'round-trip', 'low', null, 595],
      ['none', 'round-trip', 'high', null, 620],
      ['autobizz', 'single', 'low', null, 225],
      ['autobizz', 'single', 'high', null, 255],
      ['multi-trip', 'single', null, '3-9', 359],
      ['multi-trip', 'single', null, '10-19', 249],
      ['multi-trip', 'single', null, '20-34', 189],
      ['multi-trip', 'single', null, '35+', 159],
    ]);
    for (const fee of [...bridge.fees, ...ferry.fees]) {
      expect(fee.validFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(fee.source).toMatch(/oresundsbron\.com\/da\/priser|oresundslinjen\.dk\/(priser|turkort)/);
    }
  });

  it('only returns fees that are valid on the Trip Date', async () => {
    const body = await fetchFor('2026-09-13');
    const bridge = body.crossings.find((c) => c.id === 'bridge')!;
    expect(bridge.fees).toEqual([]);
    expect(body.crossings.find((c) => c.id === 'ferry')!.fees.length).toBeGreaterThan(0);
  });

  it('serves data the calculator turns into the right ferry fee for the season', async () => {
    const inputs = {
      oresundGo: false,
      autoBizz: false,
      multiTripCard: null,
      energyType: 'petrol' as const,
      consumptionPer100Km: null,
      energyPriceDkk: null,
      distanceKm: { bridge: null, ferry: null },
      plannedSpend: {},
      fillUpLitres: 0,
    };
    const feeOn = async (tripDate: string) =>
      calculateTrips({ ...inputs, tripDate }, await fetchFor(tripDate)).trips.find(
        (t) => t.crossingId === 'ferry',
      )!.crossingFeeDkk;
    expect(await feeOn('2026-11-14')).toBe(595);
    expect(await feeOn('2027-07-10')).toBe(620);
  });

  it('returns Vehicle defaults with a sourced, dated energy price per energy type', async () => {
    const body = await fetchFor('2026-11-14');
    const byType = Object.fromEntries(body.vehicleDefaults.map((v) => [v.energyType, v]));
    expect(byType.petrol!.consumptionPer100Km).toBe(6);
    expect(byType.petrol!.energyPriceDkk).toBeGreaterThan(10);
    expect(byType.electric!.consumptionPer100Km).toBeGreaterThan(10);
    expect(byType.electric!.energyPriceDkk).toBeGreaterThan(0);
    expect(Object.keys(byType).sort()).toEqual(['electric', 'petrol']);
    for (const v of body.vehicleDefaults) {
      expect(v.priceSource.length).toBeGreaterThan(0);
      expect(v.priceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('rejects an invalid Trip Date', async () => {
    const res = await app.request('/api/reference-data?dato=i-morgen');
    expect(res.status).toBe(400);
  });
});

describe('data freshness in the reference data', () => {
  const IMPORTED = new Date('2026-10-01T10:00:00Z');

  function appAt(today: string, imported: Date | null) {
    const db = openDatabase(':memory:');
    seedDatabase(db);
    if (imported) {
      recordImportRun(db, {
        source: 'test',
        startedAt: imported,
        finishedAt: imported,
        observations: [
          {
            source: 'test',
            retailerId: 'willys',
            productId: 'p1',
            productText: 'Mjölk',
            foundBy: ['mjölk'],
            price: 10,
            currency: 'SEK',
            quantity: null,
            kind: 'regular',
            validFrom: '2026-10-01',
          },
        ],
      });
    }
    return createApp(db, { now: () => new Date(`${today}T12:00:00`) });
  }

  async function freshness(app: ReturnType<typeof createApp>) {
    const res = await app.request('/api/reference-data?dato=2026-11-14');
    return ((await res.json()) as ReferenceData).freshness;
  }

  it('is fresh when the newest observation is a few days old', async () => {
    expect(await freshness(appAt('2026-10-04', IMPORTED))).toEqual({
      newestObservationDate: '2026-10-01',
      daysOld: 3,
      stale: false,
    });
  });

  it('is stale at 15 days', async () => {
    expect(await freshness(appAt('2026-10-16', IMPORTED))).toEqual({
      newestObservationDate: '2026-10-01',
      daysOld: 15,
      stale: true,
    });
  });

  it('is still fresh at exactly 14 days', async () => {
    expect(await freshness(appAt('2026-10-15', IMPORTED))).toEqual({
      newestObservationDate: '2026-10-01',
      daysOld: 14,
      stale: false,
    });
  });

  it('has no date and is not called stale when nothing has been imported', async () => {
    expect(await freshness(appAt('2026-10-16', null))).toEqual({
      newestObservationDate: null,
      daysOld: null,
      stale: false,
    });
  });
});
