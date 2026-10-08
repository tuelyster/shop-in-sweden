import { getText, type FetchFn, type Importer } from './http';

const ECB_URL = 'https://data-api.ecb.europa.eu/service/data/EXR/D.SEK+DKK.EUR.SP00.A?format=csvdata&lastNObservations=1';

/** Splits one CSV line, honouring double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else current += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      fields.push(current);
      current = '';
    } else current += ch;
  }
  fields.push(current);
  return fields;
}

/** The latest observation per currency, from the ECB's CSV format. */
function latestPerCurrency(csv: string): Map<string, { date: string; perEur: number }> {
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  if (!header) throw new Error('Empty response from the ECB');
  const columns = splitCsvLine(header);
  const at = (name: string) => columns.indexOf(name);
  const [currencyCol, dateCol, valueCol] = [at('CURRENCY'), at('TIME_PERIOD'), at('OBS_VALUE')];
  if (currencyCol < 0 || dateCol < 0 || valueCol < 0) throw new Error('Unexpected ECB CSV columns');
  const latest = new Map<string, { date: string; perEur: number }>();
  for (const row of rows) {
    const fields = splitCsvLine(row);
    const currency = fields[currencyCol]!;
    const date = fields[dateCol]!;
    const perEur = Number(fields[valueCol]);
    if (!Number.isFinite(perEur)) continue;
    const known = latest.get(currency);
    if (!known || date > known.date) latest.set(currency, { date, perEur });
  }
  return latest;
}

/** The ECB's latest reference rates: DKK and SEK per 1 EUR, and the date they apply to (the older of the two). */
export async function fetchEcbRates(fetchFn: FetchFn): Promise<{ date: string; dkkPerEur: number; sekPerEur: number }> {
  const latest = latestPerCurrency(await getText(fetchFn, ECB_URL));
  const dkk = latest.get('DKK');
  const sek = latest.get('SEK');
  if (!dkk || !sek) throw new Error('The ECB response had no DKK or SEK rate');
  return { date: dkk.date < sek.date ? dkk.date : sek.date, dkkPerEur: dkk.perEur, sekPerEur: sek.perEur };
}

/** SEK to DKK from the ECB's EUR reference rates: (DKK per EUR) / (SEK per EUR). */
export const ecbImporter: Importer = {
  name: 'ecb',
  async run({ fetch }) {
    const rates = await fetchEcbRates(fetch);
    return {
      exchangeRates: [{ date: rates.date, sekToDkk: rates.dkkPerEur / rates.sekPerEur, source: 'ECB euro foreign exchange reference rates' }],
    };
  },
};
