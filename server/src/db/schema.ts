import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
