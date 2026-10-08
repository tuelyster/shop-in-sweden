import type { Db } from './db/connection';
import { basketItems, categories, retailers } from './db/schema';
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
}

export interface Catalogue {
  categories: Category[];
  basketItems: BasketItem[];
  retailers: Retailer[];
}

/** Reads the Sample Basket and Retailers from the database, in seed order. */
export function readCatalogue(db: Db): Catalogue {
  return {
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
      })),
  };
}
