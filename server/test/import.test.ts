import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from '../src/db/connection';
import { runImport } from '../src/import/run-import';
import { buildMatchReport, formatMatchReport } from '../src/match/match-report';
import { latestExchangeRate, listImportRuns, listPriceObservations } from '../src/prices/store';
import { loadSeedData, seedDatabase, syncCatalogue } from '../src/seed';

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string) => readFileSync(resolve(fixtureDir, name), 'utf8');
const willysSearches = JSON.parse(fixture('willys-search.json')) as Record<string, unknown>;
const remaPage = fixture('rema-products.json');
const ecbCsv = fixture('ecb-exr.csv');

const NOW = new Date('2026-10-08T10:00:00Z');

interface FakeNetwork {
  fetch: typeof fetch;
  requests: string[];
}

/** Replays the recorded responses. Anything not recorded is an empty result, as for a search with no hits. */
function fakeNetwork(failing: string[] = []): FakeNetwork {
  const requests: string[] = [];
  const fetchFn = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    requests.push(url.href);
    const source = url.hostname.includes('willys') ? 'willys' : url.hostname.includes('rema1000') ? 'rema' : 'ecb';
    if (failing.includes(source)) return new Response('Service Unavailable', { status: 503 });
    if (source === 'willys') {
      const body = willysSearches[url.searchParams.get('q') ?? ''] ?? {
        results: [],
        pagination: { pageSize: 100, currentPage: 0, numberOfPages: 1, totalNumberOfResults: 0 },
      };
      return Response.json(body);
    }
    if (source === 'rema') return new Response(remaPage, { headers: { 'content-type': 'application/json' } });
    return new Response(ecbCsv);
  }) as typeof fetch;
  return { fetch: fetchFn, requests };
}

/** The lines of the match report about one Basket Item. */
function itemSection(output: string, itemName: string): string {
  const lines = output.split('\n');
  const start = lines.findIndex((l) => l === `  ${itemName}`);
  expect(start, `${itemName} in the match report`).toBeGreaterThanOrEqual(0);
  let end = start + 1;
  while (end < lines.length && lines[end]!.startsWith('    ')) end++;
  return lines.slice(start, end).join('\n');
}

function importAll(db: Db, options: { sources?: string[]; network?: FakeNetwork; now?: Date } = {}) {
  return runImport(db, {
    sources: options.sources,
    fetch: (options.network ?? fakeNetwork()).fetch,
    now: () => options.now ?? NOW,
    delayMs: 0,
  });
}

describe('import command', () => {
  let db: Db;

  beforeEach(() => {
    db = openDatabase(':memory:');
    seedDatabase(db);
  });

  it('prints a match report with the cheapest Unit Price per Basket Item and country', async () => {
    const { output, ok } = await importAll(db);
    expect(ok).toBe(true);

    // 1 SEK = 7.4745 / 11.224 DKK
    expect(output).toContain('Exchange rate: 1 SEK = 0.6659 DKK');

    const milk = itemSection(output, 'Whole milk');
    expect(milk).toContain('Denmark: PICKED REMA 1000: SØDMÆLK 3,5% | 1 LTR. / ARLA');
    expect(milk).toContain('13.50 DKK for 1 l = 13.50 DKK/l');
    expect(milk).toContain('Sweden: PICKED Willys: Mjölk Längre Hållbarhet 3% | GARANT, 1,5l');
    expect(milk).toContain('16.90 SEK for 1.5 l = 11.27 SEK/l = 7.50 DKK/l');
  });

  it('normalises multipacks, weights and counts to a Unit Price', async () => {
    const { output } = await importAll(db);
    // 15 x 33 cl for 99.90 SEK
    expect(itemSection(output, 'Cola cans')).toContain('99.90 SEK for 15 x 33 cl = 20.18 SEK/l');
    // 250 g for 7.96 DKK ... 200 g for 7.96 DKK = 39.80 per kg
    expect(itemSection(output, 'Butter')).toContain('7.96 DKK for 200 g = 39.80 DKK/kg');
    // 15 eggs for 45.25 DKK; 24 eggs for 59.90 SEK
    expect(itemSection(output, 'Eggs (each)')).toContain('45.25 DKK for 15 pcs = 3.02 DKK/pcs');
    expect(itemSection(output, 'Eggs (each)')).toContain('59.90 SEK for 24 pcs = 2.50 SEK/pcs');
    // rolls are counted, not weighed
    expect(itemSection(output, 'Toilet paper')).toContain('for 8 pcs');
  });

  it('lists the candidates the Match Rules rejected, and why', async () => {
    const { output } = await importAll(db);
    const milk = itemSection(output, 'Whole milk');
    expect(milk).toContain('rejected REMA 1000: SØDMÆLK 3,5% | 1 LTR. / GRAM SLOT, ØKOLOGISK');
    expect(milk).toContain('excluded word "øko"');
    expect(milk).toContain('SØDMÆLK 3,5% | 0.5 LTR. / ARLA [Dansk] (7.95 DKK): pack size 0.5 l outside 0.9-2.1 l');
    expect(milk).toContain('Mjölk Eko 3% | ARLA KO, 3dl [Eko] (6.90 SEK): excluded word "eko"');
    expect(itemSection(output, 'Spaghetti')).toContain('excluded word "carbonara"');
    // frozen lamb shank only looks like eggs by its name ending
    expect(itemSection(output, 'Eggs (each)')).toContain('Lammlägg Fryst Nya Zeeland');
  });

  it('flags Basket Items with no price in a country', async () => {
    const { output } = await importAll(db);
    expect(itemSection(output, 'Pick-and-mix candy')).toContain('Denmark: NO PRICE');
    expect(output).toContain('Pick-and-mix candy: no price in Denmark and Sweden');
    expect(output).toContain('Basket Items without a price');
  });

  it('stores raw Price Observations and the exchange rate, readable through the public interface', async () => {
    await importAll(db);

    const willys = listPriceObservations(db, { source: 'willys' });
    const milk = willys.find((o) => o.productText.startsWith('Mjölk Längre Hållbarhet 3% | GARANT, 1,5l'))!;
    expect(milk).toMatchObject({
      source: 'willys',
      retailerId: 'willys',
      price: 16.9,
      currency: 'SEK',
      kind: 'regular',
      quantity: { pieces: 1, size: 1.5, unit: 'l' },
      importedAt: NOW.toISOString(),
      validFrom: '2026-10-08',
    });
    expect(milk.foundBy).toEqual(['standardmjölk']);

    const cans = willys.find((o) => o.productText.startsWith('Coca-cola Zero Läsk Burk'))!;
    expect(cans).toMatchObject({ price: 99.9, quantity: { pieces: 15, size: 33, unit: 'cl' }, deposit: 30 });

    const rema = listPriceObservations(db, { source: 'rema' });
    expect(rema.find((o) => o.productText.startsWith('SMØR | 200 GR. / REMA 1000'))).toMatchObject({
      retailerId: 'rema1000',
      price: 7.96,
      currency: 'DKK',
      kind: 'regular',
      quantity: { pieces: 1, size: 200, unit: 'g' },
    });

    expect(latestExchangeRate(db)).toMatchObject({
      date: '2026-10-07',
      sekToDkk: 7.4745 / 11.224,
      source: expect.stringContaining('ECB'),
    });
  });

  it('never overwrites: a second import adds observations next to the first', async () => {
    await importAll(db, { sources: ['willys'] });
    const first = listPriceObservations(db, { source: 'willys' });
    await importAll(db, { sources: ['willys'], now: new Date('2026-10-15T10:00:00Z') });
    const all = listPriceObservations(db, { source: 'willys' });
    expect(all).toHaveLength(first.length * 2);
    expect(all.slice(0, first.length)).toEqual(first);
    expect(new Set(all.map((o) => o.importedAt))).toEqual(new Set(['2026-10-08T10:00:00.000Z', '2026-10-15T10:00:00.000Z']));
  });

  it('searches once per Swedish search word and fetches the REMA catalogue page by page', async () => {
    const network = fakeNetwork();
    await importAll(db, { network });
    const seedWords = loadSeedData().basketItems.flatMap((i) => i.matchRule.searchWords.SE);
    const willysQueries = network.requests.filter((u) => u.includes('willys.se/search')).map((u) => new URL(u).searchParams.get('q'));
    expect(willysQueries.sort()).toEqual([...new Set(seedWords)].sort());
    expect(network.requests.filter((u) => u.includes('rema1000'))).toHaveLength(1);
  });

  describe('Match Rules are applied when prices are evaluated', () => {
    it('changes the report after a rule edit without a re-import', async () => {
      const network = fakeNetwork();
      await importAll(db, { network });
      const requestsAfterImport = network.requests.length;
      const observationsBefore = listPriceObservations(db);

      const before = formatMatchReport(buildMatchReport(db));
      expect(itemSection(before, 'Whole milk')).toContain('Sweden: PICKED Willys: Mjölk Längre Hållbarhet 3% | GARANT, 1,5l');

      // Edit the rule in the seed: only accept packs up to 1.2 litres.
      const seed = loadSeedData();
      seed.basketItems.find((i) => i.id === 'whole-milk')!.matchRule.packSize = { min: 0.9, max: 1.2 };
      syncCatalogue(db, seed);

      const after = formatMatchReport(buildMatchReport(db));
      const milk = itemSection(after, 'Whole milk');
      expect(milk).toContain('Sweden: PICKED Willys: Mjölk 3% | GARANT, 1l');
      expect(milk).toContain('11.50 SEK for 1 l = 11.50 SEK/l');
      expect(milk).toContain('Mjölk Längre Hållbarhet 3% | GARANT, 1,5l (16.90 SEK): pack size 1.5 l outside 0.9-1.2 l');

      expect(network.requests).toHaveLength(requestsAfterImport);
      expect(listPriceObservations(db)).toEqual(observationsBefore);
    });

    it('lets an added excluded word reject a product', async () => {
      await importAll(db);
      const seed = loadSeedData();
      seed.basketItems.find((i) => i.id === 'whole-milk')!.matchRule.excludedWords.DK.push('arla');
      syncCatalogue(db, seed);
      const milk = itemSection(formatMatchReport(buildMatchReport(db)), 'Whole milk');
      expect(milk).toContain('Denmark: NO PRICE');
      expect(milk).toContain('excluded word "arla"');
    });
  });

  describe('isolated importers', () => {
    it('reports a failing importer and still runs and stores the others', async () => {
      const { runs, output, ok } = await importAll(db, { network: fakeNetwork(['rema']) });

      expect(ok).toBe(false);
      expect(runs.map((r) => [r.source, r.outcome])).toEqual([
        ['willys', 'success'],
        ['rema', 'failed'],
        ['ecb', 'success'],
      ]);
      expect(output).toContain('rema: FAILED, HTTP 503');
      expect(output).toContain('willys: ok');
      expect(output).toContain('ecb: ok');

      expect(listPriceObservations(db, { source: 'rema' })).toHaveLength(0);
      expect(listPriceObservations(db, { source: 'willys' }).length).toBeGreaterThan(0);
      expect(latestExchangeRate(db)).not.toBeNull();

      // The match report still prints, with Denmark empty.
      expect(itemSection(output, 'Whole milk')).toContain('Denmark: NO PRICE');
      expect(itemSection(output, 'Whole milk')).toContain('Sweden: PICKED');
    });

    it('records every run with its outcome', async () => {
      await importAll(db, { network: fakeNetwork(['ecb']) });
      const runs = listImportRuns(db);
      expect(runs.map((r) => [r.source, r.outcome])).toEqual([
        ['willys', 'success'],
        ['rema', 'success'],
        ['ecb', 'failed'],
      ]);
      expect(runs[0]!.observationCount).toBe(listPriceObservations(db, { source: 'willys' }).length);
      expect(runs[2]!.error).toContain('503');
      expect(runs[0]!.startedAt).toBe(NOW.toISOString());
    });

    it('fails an importer when the response is not what it expects', async () => {
      const broken = (async () => Response.json({ unexpected: true })) as unknown as typeof fetch;
      const { runs } = await runImport(db, { sources: ['willys'], fetch: broken, now: () => NOW, delayMs: 0 });
      expect(runs[0]).toMatchObject({ source: 'willys', outcome: 'failed' });
      expect(runs[0]!.error).toContain('Unexpected Willys search response');
    });
  });

  describe('subset selection', () => {
    it('runs only the named importers', async () => {
      const network = fakeNetwork();
      const { runs } = await importAll(db, { sources: ['ecb'], network });
      expect(runs.map((r) => r.source)).toEqual(['ecb']);
      expect(network.requests).toHaveLength(1);
      expect(listPriceObservations(db)).toHaveLength(0);
    });

    it('rejects an unknown source name', async () => {
      await expect(importAll(db, { sources: ['netto'] })).rejects.toThrow('Unknown source netto');
    });
  });
});
