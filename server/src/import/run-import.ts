import { readCatalogue } from '../catalogue';
import type { Db } from '../db/connection';
import { buildMatchReport, formatMatchReport } from '../match/match-report';
import { recordImportRun, type ImportRun } from '../prices/store';
import { ecbImporter } from '../sources/ecb';
import { oilImporter } from '../sources/oil';
import type { FetchFn, Importer } from '../sources/http';
import { remaImporter } from '../sources/rema';
import { willysImporter } from '../sources/willys';

export const importers: Importer[] = [willysImporter, remaImporter, ecbImporter, oilImporter];

export interface RunImportOptions {
  /** Importer names to run; all of them when omitted or empty. */
  sources?: string[];
  fetch: FetchFn;
  now?: () => Date;
  /** Pause between requests to the same source. */
  delayMs?: number;
  /** Replaces the built-in importers (for tests). */
  importers?: Importer[];
}

export interface RunImportResult {
  runs: ImportRun[];
  /** Printable summary of the runs followed by the match report. */
  output: string;
  /** True when every selected importer succeeded. */
  ok: boolean;
}

function describeRun(run: ImportRun): string {
  return run.outcome === 'success'
    ? `  ${run.source}: ok, ${run.observationCount} stored`
    : `  ${run.source}: FAILED, ${run.error}`;
}

/**
 * Runs all importers or a named subset, one after the other. A failing importer is recorded and
 * reported, and the others still run. Ends with the match report.
 */
export async function runImport(db: Db, options: RunImportOptions): Promise<RunImportResult> {
  const available = options.importers ?? importers;
  const wanted = options.sources ?? [];
  const unknown = wanted.filter((name) => !available.some((i) => i.name === name));
  if (unknown.length > 0) {
    throw new Error(`Unknown source ${unknown.join(', ')}. Available: ${available.map((i) => i.name).join(', ')}`);
  }
  const selected = wanted.length > 0 ? available.filter((i) => wanted.includes(i.name)) : available;

  const now = options.now ?? (() => new Date());
  const runs: ImportRun[] = [];
  for (const importer of selected) {
    const startedAt = now();
    try {
      const output = await importer.run({
        fetch: options.fetch,
        catalogue: readCatalogue(db),
        now: startedAt,
        delayMs: options.delayMs ?? 500,
      });
      runs.push(recordImportRun(db, { source: importer.name, startedAt, finishedAt: now(), ...output }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runs.push(recordImportRun(db, { source: importer.name, startedAt, finishedAt: now(), error: message }));
    }
  }

  const output = ['IMPORT', ...runs.map(describeRun), '', formatMatchReport(buildMatchReport(db))].join('\n');
  return { runs, output, ok: runs.every((r) => r.outcome === 'success') };
}
