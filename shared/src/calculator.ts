import type {
  BreakEvenSpend,
  CrossingFeeEntry,
  CrossingReference,
  ReferenceData,
  Season,
  SeasonId,
  ShoppingTripResult,
  TripComparison,
  TripInputs,
} from './types';

/** The season a Trip Date falls in; outside every seeded season it is low season. */
function seasonOf(tripDate: string, seasons: Season[]): SeasonId {
  const monthDay = tripDate.slice(5);
  const hit = seasons.find((s) => s.startMonthDay <= monthDay && monthDay <= s.endMonthDay);
  return hit ? hit.id : 'low';
}

/** Does the shopper hold the Discount Agreement this fee belongs to? */
function entitled(fee: CrossingFeeEntry, inputs: TripInputs): boolean {
  switch (fee.agreement) {
    case 'none':
      return true;
    case 'oresundgo':
      return inputs.oresundGo;
    case 'autobizz':
      return inputs.autoBizz;
    case 'multi-trip':
      return inputs.multiTripCard !== null && fee.bracket === inputs.multiTripCard;
  }
}

/**
 * The cheapest round-trip fee the shopper may use on the Trip Date: the default ticket,
 * or a Discount Agreement price they hold. Annual fees are never counted. Where the same
 * ticket has several prices, the latest one valid on the Trip Date wins.
 */
function crossingFee(crossing: CrossingReference, inputs: TripInputs, reference: ReferenceData): number {
  const season = seasonOf(inputs.tripDate, reference.seasons);
  const latest = new Map<string, CrossingFeeEntry>();
  for (const fee of crossing.fees) {
    if (fee.validFrom > inputs.tripDate) continue;
    if (fee.season !== null && fee.season !== season) continue;
    if (!entitled(fee, inputs)) continue;
    const key = `${fee.agreement}|${fee.bracket}|${fee.kind}`;
    const seen = latest.get(key);
    if (!seen || fee.validFrom > seen.validFrom) latest.set(key, fee);
  }
  const applicable = [...latest.values()];
  // A held Discount Agreement replaces the default ticket (even if a card bracket is dearer);
  // with several held agreements the cheapest wins.
  const held = applicable.filter((fee) => fee.agreement !== 'none');
  const candidates = (held.length > 0 ? held : applicable).map((fee) =>
    fee.kind === 'single' ? 2 * fee.priceDkk : fee.priceDkk,
  );
  if (candidates.length === 0) {
    throw new Error(`No Crossing Fee for crossing "${crossing.id}" on ${inputs.tripDate}`);
  }
  return Math.min(...candidates);
}

/**
 * Break-even Spend = (Trip Cost - Fill-up Saving) / spend-weighted average Price Gap.
 * Weights are the Planned Spend per Category, or equal across all Categories when none is
 * entered. Categories with an unknown Price Gap are left out of the weighting (the remaining
 * weights are renormalised by dividing by their total); if none is left it is unknown.
 * A Fill-up Saving that covers the Trip Cost gives 0, whatever the gaps are.
 */
function breakEven(
  tripCostDkk: number,
  fillUpSavingDkk: number,
  weights: { categoryId: string; weight: number; gap: number | null }[],
): { breakEvenSpend: BreakEvenSpend; excluded: string[] } {
  const excluded = weights.filter((w) => w.gap === null).map((w) => w.categoryId);
  const remaining = weights.filter((w) => w.gap !== null);
  const needed = tripCostDkk - fillUpSavingDkk;
  if (needed <= 0) return { breakEvenSpend: { kind: 'amount', dkk: 0 }, excluded };
  const totalWeight = remaining.reduce((sum, w) => sum + w.weight, 0);
  if (totalWeight === 0) return { breakEvenSpend: { kind: 'unknown' }, excluded };
  const weightedGap = remaining.reduce((sum, w) => sum + w.weight * w.gap!, 0) / totalWeight;
  if (weightedGap <= 0) return { breakEvenSpend: { kind: 'never' }, excluded };
  return { breakEvenSpend: { kind: 'amount', dkk: needed / weightedGap }, excluded };
}

/**
 * Computes one Shopping Trip per Crossing and marks the cheaper one: the one with the
 * highest Net Saving (with no Planned Spend that is the lowest Trip Cost).
 * Pure: no rounding is applied; round only for display. On a tie the first
 * Crossing in the reference data is marked cheaper, so exactly one is.
 */
export function calculateTrips(inputs: TripInputs, reference: ReferenceData): TripComparison {
  if (reference.crossings.length === 0) {
    throw new Error('Reference data has no crossings');
  }
  const vehicle = reference.vehicleDefaults.find((v) => v.energyType === inputs.energyType);
  if (!vehicle) throw new Error(`No Vehicle defaults for "${inputs.energyType}"`);
  const consumption = inputs.consumptionPer100Km ?? vehicle.consumptionPer100Km;
  const energyPrice = inputs.energyPriceDkk ?? vehicle.energyPriceDkk;

  const trips: ShoppingTripResult[] = reference.crossings.map((crossing) => {
    const crossingFeeDkk = crossingFee(crossing, inputs, reference);
    const distance = inputs.distanceKm[crossing.id];
    const drivingCostDkk = distance === null ? 0 : ((2 * distance * consumption) / 100) * energyPrice;
    const gaps = reference.priceGaps.find((g) => g.destinationId === crossing.destination.id);
    const anySpend = reference.categories.some((c) => (inputs.plannedSpend[c.id] ?? 0) > 0);
    const weights: { categoryId: string; weight: number; gap: number | null }[] = [];
    let grossSavingDkk = 0;
    const unknownGapCategoryIds: string[] = [];
    for (const category of reference.categories) {
      const spend = inputs.plannedSpend[category.id] ?? 0;
      const gap = gaps?.categories.find((c) => c.categoryId === category.id)?.priceGap ?? null;
      // Equal weights when no Planned Spend is entered; otherwise a Category weighs its spend.
      const weight = anySpend ? Math.max(spend, 0) : 1;
      if (weight > 0) weights.push({ categoryId: category.id, weight, gap });
      if (spend === 0) continue;
      if (gap === null) unknownGapCategoryIds.push(category.id);
      else grossSavingDkk += spend * gap;
    }
    const tripCostDkk = crossingFeeDkk + drivingCostDkk;
    // Ticket 11 replaces this 0 with the real Fill-up Saving; it feeds Gross Saving and Break-even.
    const fillUpSavingDkk = 0;
    const { breakEvenSpend, excluded } = breakEven(tripCostDkk, fillUpSavingDkk, weights);
    return {
      crossingId: crossing.id,
      crossingName: crossing.name,
      destination: crossing.destination,
      crossingFeeDkk,
      drivingCostDkk,
      tripCostDkk,
      grossSavingDkk,
      unknownGapCategoryIds,
      // Ticket 11 adds the Fill-up Saving to the Gross Saving here.
      netSavingDkk: grossSavingDkk - tripCostDkk,
      breakEvenSpend,
      breakEvenExcludedCategoryIds: excluded,
      isCheaper: false,
    };
  });
  let cheapest = trips[0]!;
  for (const trip of trips) {
    if (trip.netSavingDkk > cheapest.netSavingDkk) cheapest = trip;
  }
  cheapest.isCheaper = true;
  return { trips, cheaperCrossingId: cheapest.crossingId };
}
