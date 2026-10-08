import type {
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
 * Computes one Shopping Trip per Crossing and marks the cheaper one.
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
    return {
      crossingId: crossing.id,
      crossingName: crossing.name,
      destination: crossing.destination,
      crossingFeeDkk,
      drivingCostDkk,
      tripCostDkk: crossingFeeDkk + drivingCostDkk,
      isCheaper: false,
    };
  });
  let cheapest = trips[0]!;
  for (const trip of trips) {
    if (trip.tripCostDkk < cheapest.tripCostDkk) cheapest = trip;
  }
  cheapest.isCheaper = true;
  return { trips, cheaperCrossingId: cheapest.crossingId };
}
