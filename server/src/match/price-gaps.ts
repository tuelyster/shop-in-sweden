import type {
  BasketItemGap,
  CategoryPriceGap,
  DestinationPriceGaps,
  ExchangeRateInfo,
  PricePick,
} from '@shop-in-sweden/shared';
import { readCatalogue } from '../catalogue';
import type { Db } from '../db/connection';
import { stores as storesTable } from '../db/schema';
import { latestExchangeRate, listPriceObservations } from '../prices/store';
import { candidateObservations, matchItem, type Picked } from './match-report';

export interface PriceGaps {
  exchangeRate: ExchangeRateInfo | null;
  destinations: DestinationPriceGaps[];
}

function toPick(picked: Picked, seller: string): PricePick | null {
  if (picked.unitPriceDkk === null) return null;
  return {
    productName: picked.text,
    seller,
    unitPrice: picked.unitPrice.value,
    currency: picked.currency,
    unitPriceDkk: picked.unitPriceDkk,
    per: picked.unitPrice.per,
    kind: picked.kind,
    validTo: picked.validTo,
  };
}

/**
 * Measures the Price Gap of every Category at every Destination on a Trip Date (Offers valid that day count), reusing the match report's
 * Match Rule evaluation. Per Basket Item: cheapest Swedish Unit Price among the Destination's Stores
 * (in DKK at the latest exchange rate) against the cheapest Danish Unit Price over all Danish Retailers.
 * A national Swedish price counts at every Store of its Retailer; a Retailer with no Store at the
 * Destination does not count there. Basket Items not priced in both countries are left out and listed.
 */
export function measurePriceGaps(db: Db, tripDate: string): PriceGaps {
  const catalogue = readCatalogue(db);
  const rate = latestExchangeRate(db);
  const retailers = new Map(catalogue.retailers.map((r) => [r.id, r]));
  const observations = candidateObservations(listPriceObservations(db), tripDate);
  const allStores = db.select().from(storesTable).all();
  const destinationIds = [...new Set(allStores.map((s) => s.destinationId))];

  const destinations = destinationIds.map((destinationId): DestinationPriceGaps => {
    const stores = allStores.filter((s) => s.destinationId === destinationId);
    const storeIds = new Set(stores.map((s) => s.id));
    const retailersHere = new Set(stores.map((s) => s.retailerId));
    // An observation tied to a Store counts only at that Store; a national regular price at every
    // Store of its Retailer.
    const atDestination = (o: { retailerId: string; storeId?: string | null }) =>
      o.storeId ? storeIds.has(o.storeId) : retailersHere.has(o.retailerId);

    const categories = catalogue.categories.map((category): CategoryPriceGap => {
      const items = catalogue.basketItems
        .filter((b) => b.categoryId === category.id)
        .map((item): BasketItemGap => {
          const dk = matchItem(item, 'DK', observations, retailers, rate).picked;
          const se = matchItem(item, 'SE', observations, retailers, rate, atDestination).picked;
          const storeName = (p: Picked) =>
            stores.find((s) => s.id === p.storeId)?.name ??
            stores.find((s) => s.retailerId === p.retailerId)?.name ??
            p.retailer;
          const denmark = dk ? toPick(dk, dk.retailer) : null;
          const sweden = se ? toPick(se, storeName(se)) : null;
          const gap = denmark && sweden ? 1 - sweden.unitPriceDkk / denmark.unitPriceDkk : null;
          return { basketItemId: item.id, name: item.name, denmark, sweden, gap };
        });
      const priced = items.filter((i) => i.gap !== null);
      return {
        categoryId: category.id,
        priceGap: priced.length > 0 ? priced.reduce((sum, i) => sum + i.gap!, 0) / priced.length : null,
        items,
        missingItems: items.filter((i) => i.gap === null).map((i) => i.name),
      };
    });
    return { destinationId, categories };
  });

  return {
    exchangeRate: rate ? { sekToDkk: rate.sekToDkk, date: rate.date, source: rate.source } : null,
    destinations,
  };
}
