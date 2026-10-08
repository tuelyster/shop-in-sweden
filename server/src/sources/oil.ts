import readXlsx from 'read-excel-file/node';
import { fetchEcbRates } from './ecb';
import { getBytes, getText, isoDate, type Importer } from './http';

const BULLETIN_PAGE = 'https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en';
const SOURCE = 'EU Weekly Oil Bulletin, prices with taxes (Euro-super 95)';

/**
 * The page links the "prices with taxes" workbook through a download URL with a changing id,
 * so the link is found on the page each time. "without taxes" does not match "with%20Taxes".
 */
export function findBulletinLink(html: string): string {
  const hrefs = [...html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]!.replace(/&amp;/g, '&'));
  const link = hrefs.find((h) => /with%20taxes/i.test(h) && /\.xlsx/i.test(h));
  if (!link) throw new Error('No "prices with taxes" workbook linked on the Oil Bulletin page');
  return new URL(link, BULLETIN_PAGE).href;
}

export interface BulletinPrices {
  /** ISO reference date of the bulletin. */
  date: string;
  /** Euro-super 95 in EUR per litre, by country name as the sheet spells it. */
  eurPerLitre: Record<string, number>;
}

type Cell = string | number | boolean | Date | null | undefined;

/**
 * Reads Euro-super 95 from the "prices with taxes" sheet. Layout (checked against the sample):
 * row 1 holds the product headings, row 2 the unit under each ("1000 l", or "t" for fuel oil)
 * with the reference date in the first cell, then one row per country. Prices are EUR per 1000 L;
 * the unit row is checked so a changed layout fails loudly instead of giving prices 1000 times off.
 */
export function parseBulletin(rows: Cell[][], countries: string[]): BulletinPrices {
  const heading = rows[0] ?? [];
  const units = rows[1] ?? [];
  const column = heading.findIndex((h) => typeof h === 'string' && /euro-super\s*95/i.test(h));
  if (column < 0) throw new Error('No Euro-super 95 column in the Oil Bulletin');
  if (!/^\s*1000\s*l\s*$/i.test(String(units[column] ?? ''))) {
    throw new Error(`Euro-super 95 is not in EUR per 1000 l in the Oil Bulletin (unit: ${String(units[column])})`);
  }
  const reference = units[0];
  const date =
    reference instanceof Date
      ? isoDate(reference)
      : typeof reference === 'number'
        ? isoDate(new Date(Date.UTC(1899, 11, 30) + reference * 86_400_000))
        : undefined;
  if (!date) throw new Error('No reference date in the Oil Bulletin');
  const eurPerLitre: Record<string, number> = {};
  for (const country of countries) {
    const row = rows.find((r) => r[0] === country);
    const per1000 = row?.[column];
    if (typeof per1000 !== 'number') throw new Error(`No Euro-super 95 price for ${country} in the Oil Bulletin`);
    const perLitre = per1000 / 1000;
    // A sanity bound against unit or column mistakes: real prices are roughly 1 to 3 EUR per litre.
    if (perLitre < 0.5 || perLitre > 4) throw new Error(`Implausible Euro-super 95 price for ${country}: ${perLitre} EUR/L`);
    eurPerLitre[country] = perLitre;
  }
  return { date, eurPerLitre };
}

async function readRows(bytes: Uint8Array): Promise<Cell[][]> {
  const sheets = (await readXlsx(Buffer.from(bytes))) as unknown as { data: Cell[][] }[];
  const first = sheets[0];
  if (!first) throw new Error('The Oil Bulletin workbook has no sheet');
  return first.data;
}

/** Danish and Swedish petrol prices from the EU Weekly Oil Bulletin, converted with the ECB's rates. */
export const oilImporter: Importer = {
  name: 'oil',
  async run({ fetch }) {
    const link = findBulletinLink(await getText(fetch, BULLETIN_PAGE));
    const bulletin = parseBulletin(await readRows(await getBytes(fetch, link)), ['Denmark', 'Sweden']);
    const rates = await fetchEcbRates(fetch);
    const dk = bulletin.eurPerLitre['Denmark']!;
    const se = bulletin.eurPerLitre['Sweden']!;
    return {
      petrolPrices: [
        { country: 'DK', pricePerLitre: dk * rates.dkkPerEur, currency: 'DKK', priceEur: dk, date: bulletin.date, source: SOURCE },
        { country: 'SE', pricePerLitre: se * rates.sekPerEur, currency: 'SEK', priceEur: se, date: bulletin.date, source: SOURCE },
      ],
    };
  },
};
