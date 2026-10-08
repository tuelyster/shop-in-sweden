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

/** What the Vehicle runs on. */
export type EnergyType = 'petrol' | 'electric';

export const ENERGY_TYPES: readonly EnergyType[] = ['petrol', 'electric'];

/** Default Vehicle figures for one energy type, with where the price comes from. */
export interface VehicleDefault {
  energyType: EnergyType;
  /** L/100 km (petrol) or kWh/100 km (electric). */
  consumptionPer100Km: number;
  consumptionSource: string;
  /** DKK per litre (petrol) or per kWh (electric). */
  energyPriceDkk: number;
  priceSource: string;
  /** ISO date the price is from. */
  priceDate: string;
}

/**
 * Everything the calculator needs besides the shopper's inputs; served by the
 * reference-data API. Later tickets add Price Gaps, fuel prices, exchange rate etc.
 */
export interface ReferenceData {
  /** Default consumption and energy price per energy type. */
  vehicleDefaults: VehicleDefault[];
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
  /** What the Vehicle runs on. */
  energyType: EnergyType;
  /** Consumption override; null means the energy type's default. */
  consumptionPer100Km: number | null;
  /** Energy price override (DKK per L or kWh); null means the energy type's default. */
  energyPriceDkk: number | null;
  /**
   * One-way road distance in km from the Starting Point to each Destination (excluding
   * the ferry leg); null while unknown, which gives a Driving Cost of 0.
   */
  distanceKm: Record<CrossingId, number | null>;
}

export interface ShoppingTripResult {
  crossingId: CrossingId;
  crossingName: string;
  destination: Destination;
  /** Round-trip Crossing Fee in DKK, unrounded. */
  crossingFeeDkk: number;
  /** Energy cost of driving there and back in DKK, unrounded; 0 while the distance is unknown. */
  drivingCostDkk: number;
  /** Crossing Fee plus Driving Cost in DKK, unrounded. */
  tripCostDkk: number;
  /** True for exactly one trip: the one with the lowest Trip Cost. */
  isCheaper: boolean;
}

export interface TripComparison {
  trips: ShoppingTripResult[];
  cheaperCrossingId: CrossingId;
}
