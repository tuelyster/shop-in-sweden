import type { Db } from './db/connection';
import { basketItems, categories, retailers, stores } from './db/schema';
import type { Country, MatchRule } from './match/match-rule';

export interface Category {
  id: string;
  name: string;
}

export interface BasketItem {
  id: string;
  categoryId: string;
  name: string;
  matchRule: MatchRule;
}

export interface Retailer {
  id: string;
  name: string;
  country: Country;
  memberOfferPhrases: string[];
  tjekDealerId: string | null;
}

export interface Store {
  id: string;
  retailerId: string;
  destinationId: string;
  name: string;
  tjekDealerId: string | null;
  tjekStoreId: string | null;
}

export interface Catalogue {
  stores: Store[];
  categories: Category[];
  basketItems: BasketItem[];
  retailers: Retailer[];
}

/** Reads the Sample Basket and Retailers from the database, in seed order. */
export function readCatalogue(db: Db): Catalogue {
  return {
    stores: db
      .select()
      .from(stores)
      .all()
      .map((s) => ({
        id: s.id,
        retailerId: s.retailerId,
        destinationId: s.destinationId,
        name: s.name,
        tjekDealerId: s.tjekDealerId,
        tjekStoreId: s.tjekStoreId,
      })),
    categories: db.select().from(categories).orderBy(categories.sortOrder).all().map((c) => ({ id: c.id, name: c.name })),
    basketItems: db
      .select()
      .from(basketItems)
      .orderBy(basketItems.sortOrder)
      .all()
      .map((b) => ({ id: b.id, categoryId: b.categoryId, name: b.name, matchRule: JSON.parse(b.matchRule) as MatchRule })),
    retailers: db
      .select()
      .from(retailers)
      .all()
      .map((r) => ({
        id: r.id,
        name: r.name,
        country: r.country as Country,
        memberOfferPhrases: JSON.parse(r.memberOfferPhrases) as string[],
        tjekDealerId: r.tjekDealerId,
      })),
  };
}
