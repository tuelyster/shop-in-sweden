import { describe, expect, it } from 'vitest';
import {
  calculateTrips,
  type CrossingFeeEntry,
  type DestinationPriceGaps,
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

function gaps(destinationId: string, byCategory: Record<string, number | null>): DestinationPriceGaps {
  return {
    destinationId,
    categories: Object.entries(byCategory).map(([categoryId, priceGap]) => ({
      categoryId,
      priceGap,
      items: [],
      missingItems: [],
    })),
  };
}

function reference(
  overrides: { bridge?: CrossingFeeEntry[]; ferry?: CrossingFeeEntry[]; priceGaps?: DestinationPriceGaps[] } = {},
): ReferenceData {
  return {
    categories: [
      { id: 'groceries', name: 'Groceries' },
      { id: 'soft-drinks', name: 'Soft drinks' },
    ],
    priceGaps: overrides.priceGaps ?? [],
    exchangeRate: null,
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
    plannedSpend: {},
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

describe('Gross Saving and Net Saving', () => {
  const trip = (i: TripInputs, ref: ReferenceData, id: 'bridge' | 'ferry') =>
    calculateTrips(i, ref).trips.find((t) => t.crossingId === id)!;
  const spend = { groceries: 1000, 'soft-drinks': 200 };

  it('Gross Saving is the sum of Planned Spend times Price Gap at that Destination', () => {
    const ref = reference({
      priceGaps: [gaps('hyllie', { groceries: 0.2, 'soft-drinks': 0.5 }), gaps('vala', { groceries: 0.1, 'soft-drinks': 0.4 })],
    });
    expect(trip(inputs({ plannedSpend: spend }), ref, 'bridge').grossSavingDkk).toBeCloseTo(300, 10);
    expect(trip(inputs({ plannedSpend: spend }), ref, 'ferry').grossSavingDkk).toBeCloseTo(180, 10);
  });

  it('Net Saving is Gross Saving minus Trip Cost', () => {
    const ref = reference({ priceGaps: [gaps('hyllie', { groceries: 0.5 }), gaps('vala', { groceries: 0.5 })] });
    const t = trip(inputs({ plannedSpend: { groceries: 2000 }, distanceKm: { bridge: 100, ferry: 100 } }), ref, 'ferry');
    // Trip Cost 595 + 2 x 100 km x 6 L / 100 x 19.5 = 595 + 234
    expect(t.tripCostDkk).toBeCloseTo(829, 10);
    expect(t.netSavingDkk).toBeCloseTo(1000 - 829, 10);
  });

  it('a negative Price Gap lowers the Gross Saving, and Net Saving can be a loss', () => {
    const ref = reference({ priceGaps: [gaps('hyllie', { groceries: -0.1 }), gaps('vala', { groceries: 0.0 })] });
    const t = trip(inputs({ plannedSpend: { groceries: 1000 } }), ref, 'bridge');
    expect(t.grossSavingDkk).toBeCloseTo(-100, 10);
    expect(t.netSavingDkk).toBeCloseTo(-100 - 840, 10);
  });

  it('an unknown Price Gap is not treated as 0 %: it is listed and adds nothing', () => {
    const ref = reference({ priceGaps: [gaps('hyllie', { groceries: 0.2, 'soft-drinks': null })] });
    const t = trip(inputs({ plannedSpend: spend }), ref, 'bridge');
    expect(t.grossSavingDkk).toBeCloseTo(200, 10);
    expect(t.unknownGapCategoryIds).toEqual(['soft-drinks']);
    // No data at all for the Destination.
    expect(trip(inputs({ plannedSpend: spend }), ref, 'ferry').unknownGapCategoryIds).toEqual(['groceries', 'soft-drinks']);
    // No Planned Spend in a Category: nothing to report as unknown.
    expect(trip(inputs({ plannedSpend: { groceries: 100 } }), ref, 'bridge').unknownGapCategoryIds).toEqual([]);
  });

  it('with no Planned Spend the Net Saving is minus the Trip Cost', () => {
    const t = trip(inputs(), reference(), 'bridge');
    expect(t.grossSavingDkk).toBe(0);
    expect(t.netSavingDkk).toBe(-t.tripCostDkk);
  });

  it('the cheaper trip is the one with the higher Net Saving, not the lower Trip Cost', () => {
    // Ferry is the lower Trip Cost (595 vs 840) but Hyllie saves 1000 kr more on groceries.
    const ref = reference({ priceGaps: [gaps('hyllie', { groceries: 0.4 }), gaps('vala', { groceries: 0.2 })] });
    const result = calculateTrips(inputs({ plannedSpend: { groceries: 5000 } }), ref);
    expect(result.trips.find((t) => t.crossingId === 'ferry')!.tripCostDkk).toBeLessThan(
      result.trips.find((t) => t.crossingId === 'bridge')!.tripCostDkk,
    );
    expect(result.cheaperCrossingId).toBe('bridge');
    expect(result.trips.filter((t) => t.isCheaper)).toHaveLength(1);
  });
});

describe('Break-even Spend', () => {
  const trip = (i: TripInputs, ref: ReferenceData, id: 'bridge' | 'ferry' = 'bridge') =>
    calculateTrips(i, ref).trips.find((t) => t.crossingId === id)!;
  const ref = reference({
    priceGaps: [gaps('hyllie', { groceries: 0.2, 'soft-drinks': 0.5 }), gaps('vala', { groceries: -0.1, 'soft-drinks': 0 })],
  });

  it('is Trip Cost divided by the spend-weighted average Price Gap, and Net Saving is zero there', () => {
    // 1000 groceries at 20 % + 200 soft drinks at 50 % -> weighted gap 300 / 1200 = 0.25; Trip Cost 840.
    const t = trip(inputs({ plannedSpend: { groceries: 1000, 'soft-drinks': 200 } }), ref);
    expect(t.breakEvenSpend).toEqual({ kind: 'amount', dkk: expect.closeTo(840 / 0.25, 8) });
    // Scale the same mix to the break-even total: Net Saving is zero.
    const total = (t.breakEvenSpend as { dkk: number }).dkk;
    const at = trip(inputs({ plannedSpend: { groceries: (total * 1000) / 1200, 'soft-drinks': (total * 200) / 1200 } }), ref);
    expect(at.netSavingDkk).toBeCloseTo(0, 8);
  });

  it('includes the driving cost in the Trip Cost', () => {
    const t = trip(inputs({ plannedSpend: { groceries: 100 }, distanceKm: { bridge: 100, ferry: null } }), ref);
    expect(t.breakEvenSpend).toEqual({ kind: 'amount', dkk: expect.closeTo((840 + 234) / 0.2, 8) });
  });

  it('weights Categories equally when no Planned Spend is entered', () => {
    expect(trip(inputs(), ref).breakEvenSpend).toEqual({ kind: 'amount', dkk: expect.closeTo(840 / 0.35, 8) });
  });

  it('a Category with zero spend carries no weight once any spend is entered', () => {
    const t = trip(inputs({ plannedSpend: { groceries: 500 } }), ref);
    expect(t.breakEvenSpend).toEqual({ kind: 'amount', dkk: expect.closeTo(840 / 0.2, 8) });
  });

  it('is never when the weighted Price Gap is zero or negative', () => {
    expect(trip(inputs({ plannedSpend: { groceries: 100 } }), ref, 'ferry').breakEvenSpend).toEqual({ kind: 'never' });
    // Zero exactly.
    expect(trip(inputs({ plannedSpend: { 'soft-drinks': 100 } }), ref, 'ferry').breakEvenSpend).toEqual({ kind: 'never' });
    // Mixed gaps that cancel out.
    const cancel = reference({ priceGaps: [gaps('hyllie', { groceries: 0.1, 'soft-drinks': -0.1 })] });
    expect(trip(inputs({ plannedSpend: { groceries: 100, 'soft-drinks': 100 } }), cancel).breakEvenSpend).toEqual({ kind: 'never' });
  });

  it('is 0 when the Fill-up Saving covers the Trip Cost', () => {
    // Fill-up Saving is 0 until ticket 11, so only a free trip shows the rule today.
    const free = reference({
      bridge: [fee({ kind: 'single', priceDkk: 0 })],
      priceGaps: [gaps('hyllie', { groceries: 0.2 })],
    });
    expect(trip(inputs({ plannedSpend: { groceries: 100 } }), free).breakEvenSpend).toEqual({ kind: 'amount', dkk: 0 });
    // Nothing left to earn back, so 0 holds even where the gap is not positive.
    const freeNegative = reference({ bridge: [fee({ kind: 'single', priceDkk: 0 })], priceGaps: [gaps('hyllie', { groceries: -0.1 })] });
    expect(trip(inputs({ plannedSpend: { groceries: 100 } }), freeNegative).breakEvenSpend).toEqual({ kind: 'amount', dkk: 0 });
  });

  it('leaves Categories with an unknown Price Gap out of the weighting and lists them', () => {
    const partial = reference({ priceGaps: [gaps('hyllie', { groceries: 0.2, 'soft-drinks': null })] });
    const t = trip(inputs({ plannedSpend: { groceries: 1000, 'soft-drinks': 1000 } }), partial);
    expect(t.breakEvenSpend).toEqual({ kind: 'amount', dkk: expect.closeTo(840 / 0.2, 8) });
    expect(t.breakEvenExcludedCategoryIds).toEqual(['soft-drinks']);
  });

  it('is unknown, not never, when every weighted Category has an unknown Price Gap', () => {
    const none = reference({ priceGaps: [gaps('hyllie', { groceries: null, 'soft-drinks': null })] });
    const t = trip(inputs({ plannedSpend: { groceries: 1000 } }), none);
    expect(t.breakEvenSpend).toEqual({ kind: 'unknown' });
    expect(t.breakEvenExcludedCategoryIds).toEqual(['groceries']);
    // Also with no spend entered, and for a Destination with no price data at all.
    expect(trip(inputs(), none).breakEvenSpend).toEqual({ kind: 'unknown' });
    expect(trip(inputs(), none, 'ferry').breakEvenSpend).toEqual({ kind: 'unknown' });
  });
});
