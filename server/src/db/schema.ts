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

export const crossingFees =sqliteTable('crossing_fees', {
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
