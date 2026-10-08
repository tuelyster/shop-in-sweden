import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const crossings = sqliteTable('crossings', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

export const destinations = sqliteTable('destinations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  crossingId: text('crossing_id')
    .notNull()
    .references(() => crossings.id),
});

/** Yearly recurring ferry seasons, as inclusive month-day bounds. Dates outside all are low season. */
export const seasons = sqliteTable('seasons', {
  id: text('id').primaryKey(),
  startMonthDay: text('start_month_day').notNull(),
  endMonthDay: text('end_month_day').notNull(),
  source: text('source').notNull(),
});

/** Default Vehicle figures per energy type; the price carries its source and date. */
export const vehicleDefaults = sqliteTable('vehicle_defaults', {
  /** 'petrol' or 'electric'. */
  energyType: text('energy_type').primaryKey(),
  /** L/100 km (petrol) or kWh/100 km (electric). */
  consumptionPer100Km: real('consumption_per_100_km').notNull(),
  consumptionSource: text('consumption_source').notNull(),
  /** DKK per litre (petrol) or per kWh (electric). */
  energyPriceDkk: real('energy_price_dkk').notNull(),
  priceSource: text('price_source').notNull(),
  /** ISO date the price is from. */
  priceDate: text('price_date').notNull(),
});

export const crossingFees = sqliteTable('crossing_fees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  crossingId: text('crossing_id')
    .notNull()
    .references(() => crossings.id),
  /** 'single' (price per direction) or 'round-trip'. */
  kind: text('kind').notNull(),
  priceDkk: real('price_dkk').notNull(),
  /** 'none' (default ticket), 'oresundgo', 'autobizz' or 'multi-trip'. */
  agreement: text('agreement').notNull().default('none'),
  /** 'low' or 'high'; null when the price does not depend on the season. */
  season: text('season'),
  /** Multi-trip card bracket ('3-9', '10-19', '20-34', '35+'); null otherwise. */
  bracket: text('bracket'),
  /** ISO date, YYYY-MM-DD. */
  validFrom: text('valid_from').notNull(),
  source: text('source').notNull(),
});

/** Lost Deposit (Swedish pant) per container, with its source. A container up to `maxLitres` (null: any larger) costs `amountSek`. */
export const lostDeposits = sqliteTable('lost_deposits', {
  id: text('id').primaryKey(),
  description: text('description').notNull(),
  maxLitres: real('max_litres'),
  amountSek: real('amount_sek').notNull(),
  /** ISO date, YYYY-MM-DD. */
  validFrom: text('valid_from').notNull(),
  source: text('source').notNull(),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull(),
});

export const retailers = sqliteTable('retailers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** 'DK' or 'SE'. */
  country: text('country').notNull(),
  /** Phrases in offer text that mark an Offer as member-only (JSON string array). */
  memberOfferPhrases: text('member_offer_phrases').notNull().default('[]'),
  /** Tjek dealer id of a Danish Retailer's leaflets; Swedish Stores carry their own. */
  tjekDealerId: text('tjek_dealer_id'),
});

export const stores = sqliteTable('stores', {
  id: text('id').primaryKey(),
  retailerId: text('retailer_id')
    .notNull()
    .references(() => retailers.id),
  destinationId: text('destination_id')
    .notNull()
    .references(() => destinations.id),
  name: text('name').notNull(),
  tjekDealerId: text('tjek_dealer_id'),
  tjekStoreId: text('tjek_store_id'),
  willysStoreId: text('willys_store_id'),
});

export const basketItems = sqliteTable('basket_items', {
  id: text('id').primaryKey(),
  categoryId: text('category_id')
    .notNull()
    .references(() => categories.id),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull(),
  /** The Match Rule as JSON: search words, pack-size range and excluded words. */
  matchRule: text('match_rule').notNull(),
});

export const importRuns = sqliteTable('import_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** Importer name: 'willys', 'rema', 'ecb', 'oil' or 'tjek'. */
  source: text('source').notNull(),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at').notNull(),
  /** 'success' or 'failed'. */
  outcome: text('outcome').notNull(),
  observationCount: integer('observation_count').notNull().default(0),
  error: text('error'),
});

/** One price for one product at one Retailer. Rows are only ever added. */
export const priceObservations = sqliteTable('price_observations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  importRunId: integer('import_run_id')
    .notNull()
    .references(() => importRuns.id),
  source: text('source').notNull(),
  retailerId: text('retailer_id')
    .notNull()
    .references(() => retailers.id),
  /** Only set for observations tied to one Store (Swedish Offers). */
  storeId: text('store_id').references(() => stores.id),
  /** The source's own product id, used to find the latest observation per product. */
  productId: text('product_id').notNull(),
  productText: text('product_text').notNull(),
  /** The search words that returned this product in this import (JSON string array). */
  foundBy: text('found_by').notNull().default('[]'),
  price: real('price').notNull(),
  currency: text('currency').notNull(),
  /** Quantity as parsed from the source; null when no pack size could be read. */
  pieces: real('pieces'),
  size: real('size'),
  unit: text('unit'),
  /** Deposit (pant) the source reports for the whole pack, in the price's currency. */
  deposit: real('deposit'),
  /** 'regular' or 'offer'. */
  kind: text('kind').notNull(),
  memberOnly: integer('member_only', { mode: 'boolean' }).notNull().default(false),
  /** ISO dates, YYYY-MM-DD. */
  validFrom: text('valid_from').notNull(),
  validTo: text('valid_to'),
  /** ISO timestamp. */
  importedAt: text('imported_at').notNull(),
});

/** Retail price of Euro-super 95 (petrol) per country, with taxes. Rows are only ever added. */
export const petrolPrices = sqliteTable('petrol_prices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  importRunId: integer('import_run_id')
    .notNull()
    .references(() => importRuns.id),
  /** 'DK' or 'SE'. */
  country: text('country').notNull(),
  /** Price per litre in the country's own currency. */
  pricePerLitre: real('price_per_litre').notNull(),
  /** 'DKK' or 'SEK'. */
  currency: text('currency').notNull(),
  /** Price per litre in euro, as published. */
  priceEur: real('price_eur').notNull(),
  /** ISO date the prices are from (the bulletin's reference date). */
  date: text('date').notNull(),
  source: text('source').notNull(),
  importedAt: text('imported_at').notNull(),
});

export const exchangeRates =sqliteTable('exchange_rates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  importRunId: integer('import_run_id')
    .notNull()
    .references(() => importRuns.id),
  /** ISO date the rate applies to. */
  date: text('date').notNull(),
  /** DKK per 1 SEK. */
  sekToDkk: real('sek_to_dkk').notNull(),
  source: text('source').notNull(),
  importedAt: text('imported_at').notNull(),
});
/**
 * One-way road distance from a Danish postcode's centre to a Destination, via its Crossing and
 * excluding the ferry leg. Generated once by server/scripts/build-postcode-distances.ts.
 * A postcode with no road link to Sweden (Bornholm and other islands) has no rows.
 */
export const postcodeDistances = sqliteTable(
  'postcode_distances',
  {
    postcode: text('postcode').notNull(),
    name: text('name').notNull(),
    destinationId: text('destination_id')
      .notNull()
      .references(() => destinations.id),
    km: real('km').notNull(),
  },
  (t) => [primaryKey({ columns: [t.postcode, t.destinationId] })],
);
