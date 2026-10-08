/** Identifies one of the supported Crossings. */
export type CrossingId = 'bridge' | 'ferry';

/**
 * How a Crossing Fee ticket is priced.
 * - `single`: price of one direction; the round trip is 2 x this.
 * - `round-trip`: price of the same-day round-trip ticket (ferry, no agreement).
 */
export type CrossingFeeKind = 'single' | 'round-trip';

/** Which Discount Agreement a fee belongs to; `none` is the default ticket anyone can buy. */
export type DiscountAgreement = 'none' | 'oresundgo' | 'autobizz' | 'multi-trip';

/** Ferry multi-trip card brackets, by number of trips on the card. */
export type MultiTripBracket = '3-9' | '10-19' | '20-34' | '35+';

export const MULTI_TRIP_BRACKETS: readonly MultiTripBracket[] = ['3-9', '10-19', '20-34', '35+'];

/** Name of a ferry season; a Trip Date outside every seeded season is `low`. */
export type SeasonId = 'low' | 'high';

export interface CrossingFeeEntry {
  kind: CrossingFeeKind;
  priceDkk: number;
  agreement: DiscountAgreement;
  /** Season this price applies in; null when it does not depend on the season. */
  season: SeasonId | null;
  /** Card bracket (multi-trip only); null otherwise. */
  bracket: MultiTripBracket | null;
  /** ISO date (YYYY-MM-DD) from which this price applies. */
  validFrom: string;
  /** Where the price was researched. */
  source: string;
}

/** A yearly recurring season, as inclusive month-day bounds ("06-01" to "08-31"). */
export interface Season {
  id: SeasonId;
  startMonthDay: string;
  endMonthDay: string;
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
  /** Ferry seasons; any date outside all of them is low season. */
  seasons: Season[];
  crossings: CrossingReference[];
}

/**
 * The shopper's inputs. Later tickets add distances, Vehicle, Planned Spend and
 * fill-up litres.
 */
export interface TripInputs {
  /** Trip Date, ISO YYYY-MM-DD. */
  tripDate: string;
  /** Has an ØresundGO agreement (bridge). */
  oresundGo: boolean;
  /** Has an AutoBizz agreement (ferry). */
  autoBizz: boolean;
  /** Ferry multi-trip card bracket, or null for no card. */
  multiTripCard: MultiTripBracket | null;
}

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
