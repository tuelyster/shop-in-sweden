import type { ObservationDraft } from '../prices/store';
import { getJson, isoDate, pause, type Importer } from './http';
import { parseQuantity } from './quantity';

const SEARCH_URL = 'https://www.willys.se/search';
const PAGE_SIZE = 100;
/** Pages fetched per search word at most. The first pages hold the most relevant hits. */
const MAX_PAGES = 3;

interface WillysProduct {
  code: string;
  name: string;
  manufacturer?: string | null;
  productLine2?: string | null;
  displayVolume?: string | null;
  priceValue: number;
  /** Deposit for the whole pack, e.g. "30,00 kr". */
  depositPrice?: string | null;
  labels?: string[] | null;
}

interface WillysSearchResponse {
  results: WillysProduct[];
  pagination: { numberOfPages: number };
}

/** Labels that matter to Match Rules, in Swedish so the excluded words ("eko", "laktosfri") see them. */
const LABEL_TEXT: Record<string, string> = {
  ecological: 'Eko',
  laktosfree: 'Laktosfri',
  glutenfree: 'Glutenfri',
  frozen: 'Fryst',
};

function parseSek(text: string | null | undefined): number | null {
  if (!text) return null;
  const n = Number(text.replace(/[^\d,]/g, '').replace(',', '.'));
  return Number.isFinite(n) && text.trim() !== '' ? n : null;
}

function isSearchResponse(value: unknown): value is WillysSearchResponse {
  const v = value as WillysSearchResponse | null;
  return !!v && Array.isArray(v.results) && typeof v.pagination?.numberOfPages === 'number';
}

function productText(p: WillysProduct): string {
  const tags = (p.labels ?? []).map((l) => LABEL_TEXT[l]).filter(Boolean);
  const base = p.productLine2 ? `${p.name} | ${p.productLine2}` : p.name;
  return tags.length > 0 ? `${base} [${tags.join(', ')}]` : base;
}

/**
 * Willys regular prices (Sweden). One search per Swedish search word of every Basket Item, run one
 * after the other. Willys regular prices count at every Willys Store, so they are stored per Retailer.
 */
export const willysImporter: Importer = {
  name: 'willys',
  async run({ fetch, catalogue, now, delayMs }) {
    const words = [...new Set(catalogue.basketItems.flatMap((item) => item.matchRule.searchWords.SE))];
    const products = new Map<string, { product: WillysProduct; foundBy: string[] }>();
    let first = true;
    for (const word of words) {
      for (let page = 0; page < MAX_PAGES; page++) {
        if (!first) await pause(delayMs);
        first = false;
        const url = `${SEARCH_URL}?q=${encodeURIComponent(word)}&size=${PAGE_SIZE}&page=${page}`;
        const body = await getJson(fetch, url);
        if (!isSearchResponse(body)) throw new Error(`Unexpected Willys search response shape for "${word}"`);
        for (const product of body.results) {
          const known = products.get(product.code);
          if (known) {
            if (!known.foundBy.includes(word)) known.foundBy.push(word);
          } else {
            products.set(product.code, { product, foundBy: [word] });
          }
        }
        if (page + 1 >= body.pagination.numberOfPages) break;
      }
    }

    const today = isoDate(now);
    const observations: ObservationDraft[] = [];
    for (const { product, foundBy } of products.values()) {
      if (typeof product.priceValue !== 'number') continue;
      observations.push({
        source: 'willys',
        retailerId: 'willys',
        productId: product.code,
        productText: productText(product),
        foundBy,
        price: product.priceValue,
        currency: 'SEK',
        quantity: parseQuantity(product.displayVolume ?? product.productLine2?.split(',').pop()),
        deposit: parseSek(product.depositPrice),
        kind: 'regular',
        validFrom: today,
      });
    }
    return { observations };
  },
};
