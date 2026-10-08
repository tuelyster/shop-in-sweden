import type {
  CrossingFeeEntry,
  CrossingReference,
  ReferenceData,
  ShoppingTripResult,
  TripComparison,
  TripInputs,
} from './types';

function crossingFee(crossing: CrossingReference): number {
  // Default fees only: the cheapest ticket anyone can buy without a subscription.
  const candidates = crossing.fees.map((fee: CrossingFeeEntry) =>
    fee.kind === 'single' ? 2 * fee.priceDkk : fee.priceDkk,
  );
  if (candidates.length === 0) {
    throw new Error(`No Crossing Fee for crossing "${crossing.id}"`);
  }
  return Math.min(...candidates);
}

/**
 * Computes one Shopping Trip per Crossing and marks the cheaper one.
 * Pure: no rounding is applied; round only for display. On a tie the first
 * Crossing in the reference data is marked cheaper, so exactly one is.
 */
export function calculateTrips(_inputs: TripInputs, reference: ReferenceData): TripComparison {
  if (reference.crossings.length === 0) {
    throw new Error('Reference data has no crossings');
  }
  const trips: ShoppingTripResult[] = reference.crossings.map((crossing) => ({
    crossingId: crossing.id,
    crossingName: crossing.name,
    destination: crossing.destination,
    crossingFeeDkk: crossingFee(crossing),
    isCheaper: false,
  }));
  let cheapest = trips[0]!;
  for (const trip of trips) {
    if (trip.crossingFeeDkk < cheapest.crossingFeeDkk) cheapest = trip;
  }
  cheapest.isCheaper = true;
  return { trips, cheaperCrossingId: cheapest.crossingId };
}
