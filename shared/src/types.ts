/** Identifies one of the supported Crossings. */
export type CrossingId = 'bridge' | 'ferry';

/**
 * How a Crossing Fee ticket is priced.
 * - `single`: price of one direction; the round trip is 2 x this (bridge online ticket).
 * - `round-trip`: price of the same-day round-trip ticket (ferry).
 * Later tickets add Discount Agreement kinds and season/bracket fields here.
 */
export type CrossingFeeKind = 'single' | 'round-trip';

export interface CrossingFeeEntry {
  kind: CrossingFeeKind;
  priceDkk: number;
  /** ISO date (YYYY-MM-DD) from which this price applies. */
  validFrom: string;
  /** Where the price was researched. */
  source: string;
}

export interface Destination {
  id: string;
  name: string;
}

export interface CrossingReference {
  id: CrossingId;
  name: string;
  destination: Destination;
  fees: CrossingFeeEntry[];
}

/**
 * Everything the calculator needs besides the shopper's inputs; served by the
 * reference-data API. Later tickets add Price Gaps, fuel prices, exchange rate etc.
 */
export interface ReferenceData {
  crossings: CrossingReference[];
}

/**
 * The shopper's inputs. Empty for now; later tickets add Trip Date, distances,
 * Vehicle, Discount Agreements, Planned Spend and fill-up litres.
 */
export interface TripInputs {}

export interface ShoppingTripResult {
  crossingId: CrossingId;
  crossingName: string;
  destination: Destination;
  /** Round-trip Crossing Fee in DKK, unrounded. */
  crossingFeeDkk: number;
  /** True for exactly one trip: the one with the lowest Trip Cost. */
  isCheaper: boolean;
}

export interface TripComparison {
  trips: ShoppingTripResult[];
  cheaperCrossingId: CrossingId;
}
