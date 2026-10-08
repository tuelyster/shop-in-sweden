import { describe, expect, it } from 'vitest';
import {
  calculateTrips,
  type CrossingFeeEntry,
  type ReferenceData,
  type TripInputs,
} from './index';

type FeeSpec = Partial<CrossingFeeEntry> & Pick<CrossingFeeEntry, 'kind' | 'priceDkk'>;

function fee(spec: FeeSpec): CrossingFeeEntry {
  return { agreement: 'none', season: null, bracket: null, validFrom: '2026-01-01', source: 'test', ...spec };
}

const bridgeFees = [
  fee({ kind: 'single', priceDkk: 420 }),
  fee({ kind: 'single', priceDkk: 182, agreement: 'oresundgo' }),
];

const ferryFees = [
  fee({ kind: 'round-trip', priceDkk: 595, season: 'low' }),
  fee({ kind: 'round-trip', priceDkk: 620, season: 'high' }),
  fee({ kind: 'single', priceDkk: 225, season: 'low', agreement: 'autobizz' }),
  fee({ kind: 'single', priceDkk: 255, season: 'high', agreement: 'autobizz' }),
  fee({ kind: 'single', priceDkk: 359, agreement: 'multi-trip', bracket: '3-9' }),
  fee({ kind: 'single', priceDkk: 249, agreement: 'multi-trip', bracket: '10-19' }),
  fee({ kind: 'single', priceDkk: 189, agreement: 'multi-trip', bracket: '20-34' }),
  fee({ kind: 'single', priceDkk: 159, agreement: 'multi-trip', bracket: '35+' }),
];

function reference(overrides: { bridge?: CrossingFeeEntry[]; ferry?: CrossingFeeEntry[] } = {}): ReferenceData {
  return {
    vehicleDefaults: [
      { energyType: 'petrol', consumptionPer100Km: 6, consumptionSource: 'test', energyPriceDkk: 19.5, priceSource: 'test', priceDate: '2026-10-05' },
      { energyType: 'electric', consumptionPer100Km: 18, consumptionSource: 'test', energyPriceDkk: 2.5, priceSource: 'test', priceDate: '2026-10-08' },
    ],
    seasons: [{ id: 'high', startMonthDay: '06-01', endMonthDay: '08-31', source: 'test' }],
    crossings: [
      {
        id: 'bridge',
        name: 'Øresundsbron',
        destination: { id: 'hyllie', name: 'Hyllie/Emporia' },
        fees: overrides.bridge ?? bridgeFees,
      },
      {
        id: 'ferry',
        name: 'Helsingør–Helsingborg',
        destination: { id: 'vala', name: 'Väla Centrum' },
        fees: overrides.ferry ?? ferryFees,
      },
    ],
  };
}

const LOW_DAY = '2026-11-14';
const HIGH_DAY = '2026-07-11';

function inputs(overrides: Partial<TripInputs> = {}): TripInputs {
  return {
    tripDate: LOW_DAY,
    oresundGo: false,
    autoBizz: false,
    multiTripCard: null,
    energyType: 'petrol',
    consumptionPer100Km: null,
    energyPriceDkk: null,
    distanceKm: { bridge: null, ferry: null },
    ...overrides,
  };
}

function fees(i: TripInputs, ref: ReferenceData = reference()) {
  const { trips } = calculateTrips(i, ref);
  return {
    bridge: trips.find((t) => t.crossingId === 'bridge')!.crossingFeeDkk,
    ferry: trips.find((t) => t.crossingId === 'ferry')!.crossingFeeDkk,
  };
}

describe('Crossing Fees without a Discount Agreement', () => {
  it('prices the bridge as 2 x the single ticket and the ferry as the round-trip ticket', () => {
    expect(fees(inputs())).toEqual({ bridge: 840, ferry: 595 });
  });

  it('uses the high-season ferry round trip in high season', () => {
    expect(fees(inputs({ tripDate: HIGH_DAY }))).toEqual({ bridge: 840, ferry: 620 });
  });

  it('ignores Discount Agreement prices the shopper does not have', () => {
    // The bridge fee must not fall to the cheaper ØresundGO price.
    expect(fees(inputs()).bridge).toBe(840);
    expect(fees(inputs()).ferry).toBe(595);
  });

  it('keeps decimals unrounded', () => {
    const ref = reference({ bridge: [fee({ kind: 'single', priceDkk: 100.255 })] });
    expect(fees(inputs(), ref).bridge).toBeCloseTo(200.51, 10);
  });
});

describe('ferry season boundaries', () => {
  it.each([
    ['2026-05-31', 595, 450],
    ['2026-06-01', 620, 510],
    ['2026-08-31', 620, 510],
    ['2026-09-01', 595, 450],
  ])('Trip Date %s: no agreement %d, AutoBizz %d', (tripDate, plain, autoBizz) => {
    expect(fees(inputs({ tripDate })).ferry).toBe(plain);
    expect(fees(inputs({ tripDate, autoBizz: true })).ferry).toBe(autoBizz);
  });
});

describe('Discount Agreements', () => {
  it('ØresundGO: bridge is 2 x the ØresundGO price, ferry unchanged', () => {
    expect(fees(inputs({ oresundGo: true }))).toEqual({ bridge: 364, ferry: 595 });
  });

  it('AutoBizz: ferry is 2 x the season single price, bridge unchanged', () => {
    expect(fees(inputs({ autoBizz: true }))).toEqual({ bridge: 840, ferry: 450 });
    expect(fees(inputs({ autoBizz: true, tripDate: HIGH_DAY }))).toEqual({ bridge: 840, ferry: 510 });
  });

  it.each([
    ['3-9', 718],
    ['10-19', 498],
    ['20-34', 378],
    ['35+', 318],
  ] as const)('multi-trip card %s: ferry is 2 x the per-trip price (%d)', (bracket, expected) => {
    for (const tripDate of [LOW_DAY, HIGH_DAY]) {
      expect(fees(inputs({ multiTripCard: bracket, tripDate })).ferry).toBe(expected);
    }
  });

  it('with both AutoBizz and a card, the cheaper one is used', () => {
    // 35+ card (318) beats AutoBizz (450); a 3-9 card (718) loses to AutoBizz (450).
    expect(fees(inputs({ autoBizz: true, multiTripCard: '35+' })).ferry).toBe(318);
    expect(fees(inputs({ autoBizz: true, multiTripCard: '3-9' })).ferry).toBe(450);
  });

  it('a held card replaces the plain ticket even when its bracket is dearer', () => {
    expect(fees(inputs({ multiTripCard: '3-9' })).ferry).toBe(718);
  });

  it('all agreements together price both Crossings independently', () => {
    expect(fees(inputs({ oresundGo: true, autoBizz: true, multiTripCard: '10-19' }))).toEqual({
      bridge: 364,
      ferry: 450,
    });
  });
});

describe('valid-from dates', () => {
  it('ignores a fee that is not yet valid on the Trip Date and uses the latest valid one', () => {
    const ref = reference({
      bridge: [
        fee({ kind: 'single', priceDkk: 400, validFrom: '2026-01-01' }),
        fee({ kind: 'single', priceDkk: 420, validFrom: '2026-09-14' }),
        fee({ kind: 'single', priceDkk: 500, validFrom: '2027-01-01' }),
      ],
    });
    expect(fees(inputs({ tripDate: '2026-09-13' }), ref).bridge).toBe(800);
    expect(fees(inputs({ tripDate: '2026-11-14' }), ref).bridge).toBe(840);
  });

  it('throws when no fee applies', () => {
    const ref = reference({ bridge: [fee({ kind: 'single', priceDkk: 420, validFrom: '2027-01-01' })] });
    expect(() => calculateTrips(inputs(), ref)).toThrow(/bridge/);
  });
});

describe('cheaper Crossing', () => {
  it('marks the ferry cheaper when it has the lower Crossing Fee', () => {
    const result = calculateTrips(inputs(), reference());
    expect(result.cheaperCrossingId).toBe('ferry');
    expect(result.trips.filter((t) => t.isCheaper).map((t) => t.crossingId)).toEqual(['ferry']);
  });

  it('marks the bridge cheaper with ØresundGO against a high-season ferry', () => {
    const result = calculateTrips(inputs({ oresundGo: true, tripDate: HIGH_DAY }), reference());
    expect(result.cheaperCrossingId).toBe('bridge');
    expect(result.trips.filter((t) => t.isCheaper)).toHaveLength(1);
  });

  it('marks exactly one trip cheaper on a tie', () => {
    const ref = reference({
      bridge: [fee({ kind: 'single', priceDkk: 300 })],
      ferry: [fee({ kind: 'round-trip', priceDkk: 600 })],
    });
    expect(calculateTrips(inputs(), ref).trips.filter((t) => t.isCheaper)).toHaveLength(1);
  });
});

describe('Driving Cost and Trip Cost', () => {
  const trip = (i: TripInputs, id: 'bridge' | 'ferry') =>
    calculateTrips(i, reference()).trips.find((t) => t.crossingId === id)!;
  const km = (bridge: number | null, ferry: number | null) => ({ bridge, ferry });

  it('is 0 while the distance is unknown, so Trip Cost equals the Crossing Fee', () => {
    const t = trip(inputs(), 'ferry');
    expect(t.drivingCostDkk).toBe(0);
    expect(t.tripCostDkk).toBe(595);
  });

  it('petrol: 2 x distance x consumption / 100 x price, per Shopping Trip', () => {
    const i = inputs({ distanceKm: km(50, 100) });
    expect(trip(i, 'bridge').drivingCostDkk).toBeCloseTo(117, 10);
    expect(trip(i, 'ferry').drivingCostDkk).toBeCloseTo(234, 10);
    expect(trip(i, 'ferry').tripCostDkk).toBeCloseTo(595 + 234, 10);
  });

  it('electric uses the electric defaults', () => {
    const t = trip(inputs({ energyType: 'electric', distanceKm: km(50, 100) }), 'ferry');
    expect(t.drivingCostDkk).toBeCloseTo(90, 10);
  });

  it('edited consumption and energy price replace the defaults independently', () => {
    const d = km(null, 100);
    expect(trip(inputs({ distanceKm: d, consumptionPer100Km: 8 }), 'ferry').drivingCostDkk).toBeCloseTo(312, 10);
    expect(trip(inputs({ distanceKm: d, energyPriceDkk: 20 }), 'ferry').drivingCostDkk).toBeCloseTo(240, 10);
    expect(
      trip(inputs({ distanceKm: d, consumptionPer100Km: 8, energyPriceDkk: 20 }), 'ferry').drivingCostDkk,
    ).toBeCloseTo(320, 10);
  });

  it('decides the cheaper trip on Trip Cost, not Crossing Fee', () => {
    // With ØresundGO the bridge fee (364) beats the ferry (595) ...
    const feesOnly = calculateTrips(inputs({ oresundGo: true }), reference());
    expect(feesOnly.cheaperCrossingId).toBe('bridge');
    // ... but a much longer drive to Hyllie flips it: 364 + 585 = 949 vs 595 + 117 = 712.
    const withDriving = calculateTrips(inputs({ oresundGo: true, distanceKm: km(250, 50) }), reference());
    expect(withDriving.cheaperCrossingId).toBe('ferry');
    expect(withDriving.trips.filter((t) => t.isCheaper)).toHaveLength(1);
  });

  it('throws when the energy type has no defaults', () => {
    const ref = { ...reference(), vehicleDefaults: [] };
    expect(() => calculateTrips(inputs(), ref)).toThrow(/petrol/);
  });
});
