import type { Catalogue } from '../catalogue';
import type { ExchangeRateDraft, ObservationDraft } from '../prices/store';

/** The network, injected so tests can replay recorded responses. */
export type FetchFn = typeof fetch;

/** Everything an importer needs to do its job. */
export interface ImportContext {
  fetch: FetchFn;
  catalogue: Catalogue;
  /** The moment the import runs; also decides "today" for validity dates. */
  now: Date;
  /** Pause between requests to the same source. */
  delayMs: number;
}

export interface ImportOutput {
  observations?: ObservationDraft[];
  exchangeRates?: ExchangeRateDraft[];
}

export interface Importer {
  /** The name used to select it on the command line. */
  name: string;
  run(context: ImportContext): Promise<ImportOutput>;
}

export async function pause(ms: number): Promise<void> {
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
}

async function ok(response: Response, url: string): Promise<Response> {
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response;
}

export async function getJson(fetchFn: FetchFn, url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const response = await ok(await fetchFn(url, { headers: { Accept: 'application/json', ...headers } }), url);
  try {
    return await response.json();
  } catch {
    throw new Error(`Response from ${url} was not JSON`);
  }
}

export async function getText(fetchFn: FetchFn, url: string): Promise<string> {
  return (await ok(await fetchFn(url), url)).text();
}

/** ISO date (YYYY-MM-DD) of a moment, in UTC. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
