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

export const crossingFees = sqliteTable('crossing_fees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  crossingId: text('crossing_id')
    .notNull()
    .references(() => crossings.id),
  /** 'single' (price per direction) or 'round-trip'. */
  kind: text('kind').notNull(),
  priceDkk: real('price_dkk').notNull(),
  /** ISO date, YYYY-MM-DD. */
  validFrom: text('valid_from').notNull(),
  source: text('source').notNull(),
});
