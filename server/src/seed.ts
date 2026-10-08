import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { notInArray } from 'drizzle-orm';
import type { Db } from './db/connection';
import {
  basketItems,
  categories,
  crossingFees,
  crossings,
  destinations,
  retailers,
  seasons,
  stores,
  vehicleDefaults,
} from './db/schema';
import type { MatchRule } from './match/match-rule';

const seedDir = resolve(dirname(fileURLToPath(import.meta.url)), '../seed');

function readSeed<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(seedDir, file), 'utf8')) as T;
}

export interface SeedBasketItem {
  id: string;
  categoryId: string;
  name: string;
  matchRule: MatchRule;
}

export interface SeedStore {
  id: string;
  retailerId: string;
  destinationId: string;
  name: string;
  tjekDealerId?: string;
  tjekStoreId?: string;
  willysStoreId?: string;
}

export interface SeedData {
  crossings: { id: string; name: string; destination: { id: string; name: string } }[];
  crossingFees: {
    crossingId: string;
    kind: string;
    priceDkk: number;
    agreement: string;
    season: string | null;
    bracket: string | null;
    validFrom: string;
    source: string;
  }[];
  seasons: { id: string; startMonthDay: string; endMonthDay: string; source: string }[];
  vehicleDefaults: (typeof vehicleDefaults.$inferInsert)[];
  categories: { id: string; name: string }[];
  retailers: { id: string; name: string; country: 'DK' | 'SE'; memberOfferPhrases: string[] }[];
  stores: SeedStore[];
  basketItems: SeedBasketItem[];
}

/** Reads the versioned seed files. */
export function loadSeedData(): SeedData {
  const basket = readSeed<Pick<SeedData, 'categories' | 'basketItems'>>('basket.json');
  const retailerSeed = readSeed<Pick<SeedData, 'retailers' | 'stores'>>('retailers.json');
  return {
    crossings: readSeed('crossings.json'),
    crossingFees: readSeed('crossing-fees.json'),
    seasons: readSeed('seasons.json'),
    vehicleDefaults: readSeed('vehicle-defaults.json'),
    categories: basket.categories,
    basketItems: basket.basketItems,
    retailers: retailerSeed.retailers,
    stores: retailerSeed.stores,
  };
}

/**
 * Brings the catalogue tables (Categories, Retailers, Stores, Basket Items with their Match Rules)
 * in line with the seed, keeping all imported Price Observations. Safe to run repeatedly.
 */
export function syncCatalogue(db: Db, seed: SeedData): void {
  db.transaction((tx) => {
    seed.categories.forEach((c, i) => {
      tx.insert(categories)
        .values({ id: c.id, name: c.name, sortOrder: i })
        .onConflictDoUpdate({ target: categories.id, set: { name: c.name, sortOrder: i } })
        .run();
    });
    for (const r of seed.retailers) {
      const values = { name: r.name, country: r.country, memberOfferPhrases: JSON.stringify(r.memberOfferPhrases) };
      tx.insert(retailers).values({ id: r.id, ...values }).onConflictDoUpdate({ target: retailers.id, set: values }).run();
    }
    for (const s of seed.stores) {
      const values = {
        retailerId: s.retailerId,
        destinationId: s.destinationId,
        name: s.name,
        tjekDealerId: s.tjekDealerId ?? null,
        tjekStoreId: s.tjekStoreId ?? null,
        willysStoreId: s.willysStoreId ?? null,
      };
      tx.insert(stores).values({ id: s.id, ...values }).onConflictDoUpdate({ target: stores.id, set: values }).run();
    }
    seed.basketItems.forEach((item, i) => {
      const values = {
        categoryId: item.categoryId,
        name: item.name,
        sortOrder: i,
        matchRule: JSON.stringify(item.matchRule),
      };
      tx.insert(basketItems)
        .values({ id: item.id, ...values })
        .onConflictDoUpdate({ target: basketItems.id, set: values })
        .run();
    });
    tx.delete(basketItems)
      .where(notInArray(basketItems.id, seed.basketItems.map((i) => i.id)))
      .run();
  });
}

/** Loads the seed into an empty database. */
export function seedDatabase(db: Db, seed: SeedData = loadSeedData()): void {
  db.transaction((tx) => {
    for (const v of seed.vehicleDefaults) tx.insert(vehicleDefaults).values(v).run();
    for (const c of seed.crossings) {
      tx.insert(crossings).values({ id: c.id, name: c.name }).run();
      tx.insert(destinations).values({ ...c.destination, crossingId: c.id }).run();
    }
    for (const s of seed.seasons) tx.insert(seasons).values(s).run();
    for (const fee of seed.crossingFees) tx.insert(crossingFees).values(fee).run();
  });
  syncCatalogue(db, seed);
}
