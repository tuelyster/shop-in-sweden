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

/** Identifies a Category (groceries, candy-snacks, soft-drinks, personal-care-household). */
export type CategoryId = string;

export interface CategoryReference {
  id: CategoryId;
  name: string;
}

/** The cheapest Unit Price found for a Basket Item in one country, and where it came from. */
export interface PricePick {
  productName: string;
  /** The Retailer (Denmark) or the Store at the Destination (Sweden). */
  seller: string;
  /** Unit Price in the price's own currency, per `per`. */
  unitPrice: number;
  currency: 'DKK' | 'SEK';
  unitPriceDkk: number;
  per: 'kg' | 'l' | 'pcs';
  kind: 'regular' | 'offer';
  /** ISO date an Offer is valid to; null for a regular price. */
  validTo: string | null;
}

/** One Basket Item compared at a Destination. */
export interface BasketItemGap {
  basketItemId: string;
  name: string;
  denmark: PricePick | null;
  sweden: PricePick | null;
  /** 1 - (Swedish DKK Unit Price / Danish Unit Price); null unless priced in both countries. */
  gap: number | null;
}

/** The Price Gap of one Category at one Destination, with the Basket Items behind it. */
export interface CategoryPriceGap {
  categoryId: CategoryId;
  /**
   * Unweighted mean of the item gaps over Basket Items priced in both countries (0.1 = 10 %
   * cheaper in Sweden, negative = dearer). Null when no Basket Item is priced in both: unknown, not 0.
   */
  priceGap: number | null;
  items: BasketItemGap[];
  /** Names of Basket Items left out because they are not priced in both countries. */
  missingItems: string[];
}

export interface DestinationPriceGaps {
  destinationId: string;
  categories: CategoryPriceGap[];
}

/** The SEK to DKK rate the Price Gaps were converted at. */
export interface ExchangeRateInfo {
  /** DKK per 1 SEK. */
  sekToDkk: number;
  /** ISO date the rate applies to. */
  date: string;
  source: string;
}

/** The latest imported petrol price (Euro-super 95, with taxes) of one country. */
export interface PetrolPriceInfo {
  /** Price per litre in the country's own currency. */
  pricePerLitre: number;
  currency: 'DKK' | 'SEK';
  /** ISO date the price is from. */
  date: string;
  source: string;
}

/**
 * Everything the calculator needs besides the shopper's inputs; served by the
 * reference-data API. Later tickets add Price Gaps, fuel prices, exchange rate etc.
 */
/** How current the Price Observations are. */
export interface DataFreshness {
  /** ISO date of the newest import that stored a Price Observation; null before any import. */
  newestObservationDate: string | null;
  /** Whole days from that date to today; null before any import. */
  daysOld: number | null;
  /** True when the newest observation is more than 14 days old. False when there is no data at all. */
  stale: boolean;
}

export interface ReferenceData {
  /** Default consumption and energy price per energy type. */
  vehicleDefaults: VehicleDefault[];
  /** Ferry seasons; any date outside all of them is low season. */
  seasons: Season[];
  crossings: CrossingReference[];
  /** The four Categories, in display order. */
  categories: CategoryReference[];
  /** Price Gaps per Destination (regular prices only until Offers arrive). */
  priceGaps: DestinationPriceGaps[];
  /** Rate used for the Price Gaps; null while none has been imported. */
  exchangeRate: ExchangeRateInfo | null;
  /** How current the prices are, for the freshness line and stale warning. */
  freshness: DataFreshness;
  /**
   * Latest imported petrol prices; null for a country while none has been imported. The Danish
   * one is also the default petrol price of the Vehicle defaults.
   */
  petrolPrices: { denmark: PetrolPriceInfo | null; sweden: PetrolPriceInfo | null };
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
  /** Planned Spend in DKK at Danish prices, per Category; a missing Category counts as 0. */
  plannedSpend: Record<CategoryId, number>;
  /** Litres of petrol the shopper would fill up in Sweden; ignored for electric Vehicles. */
  fillUpLitres: number;
}

/**
 * The Break-even Spend of a Shopping Trip: `amount` is the total Planned Spend in DKK (unrounded)
 * at which Net Saving is zero; `never` means the weighted Price Gap is zero or negative, so no
 * spend makes the trip pay off; `unknown` means every Category in the mix has an unknown Price Gap.
 */
export type BreakEvenSpend = { kind: 'amount'; dkk: number } | { kind: 'never' } | { kind: 'unknown' };

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
  /**
   * Gross Saving in DKK, unrounded: sum of Planned Spend x Price Gap over the Categories with a
   * known Price Gap here. Can be negative.
   */
  grossSavingDkk: number;
  /**
   * Fill-up Saving in DKK, unrounded: litres x (Danish petrol price - Swedish petrol price in DKK).
   * 0 for electric Vehicles, without litres, or while a petrol price or the exchange rate is missing.
   * Negative if Sweden is dearer. Already included in the Gross Saving.
   */
  fillUpSavingDkk: number;
  /** Categories with Planned Spend but no known Price Gap here; they add nothing to the Gross Saving. */
  unknownGapCategoryIds: CategoryId[];
  /** Gross Saving minus Trip Cost, unrounded; negative is a loss. */
  netSavingDkk: number;
  /** Spend at which Net Saving is zero for the shopper's Category mix at this Destination. */
  breakEvenSpend: BreakEvenSpend;
  /** Categories left out of the Break-even Spend weighting because their Price Gap is unknown here. */
  breakEvenExcludedCategoryIds: CategoryId[];
  /** True for exactly one trip: the one with the highest Net Saving. */
  isCheaper: boolean;
}

export interface TripComparison {
  trips: ShoppingTripResult[];
  cheaperCrossingId: CrossingId;
}
