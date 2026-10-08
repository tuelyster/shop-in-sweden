import { defaultDatabasePath, openDatabase } from './db/connection';
import { buildMatchReport, formatMatchReport } from './match/match-report';
import { importers, runImport } from './import/run-import';
import { loadSeedData, syncCatalogue } from './seed';

const usage = `Usage:
  npm run import -- [source ...]   fetch prices from all sources, or only the named ones (${importers.map((i) => i.name).join(', ')}), then print the match report
  npm run report                   print the match report from stored prices without fetching (picks up Match Rule edits in the seed files)`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(usage);
  process.exit(0);
}

const db = openDatabase(process.env.DATABASE_PATH ?? defaultDatabasePath);
// Pick up edits to Match Rules, Stores and Retailers in the seed files without touching stored prices.
syncCatalogue(db, loadSeedData());

if (args[0] === 'report') {
  console.log(formatMatchReport(buildMatchReport(db)));
} else {
  try {
    const result = await runImport(db, { sources: args, fetch });
    console.log(result.output);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error(usage);
    process.exitCode = 2;
  }
}
