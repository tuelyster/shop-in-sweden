import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './db/connection';
import { crossingFees, crossings, destinations } from './db/schema';

const seedDir = resolve(dirname(fileURLToPath(import.meta.url)), '../seed');

function readSeed<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(seedDir, file), 'utf8')) as T;
}

/** Loads the versioned seed files into an empty database. */
export function seedDatabase(db: Db): void {
  const crossingSeed = readSeed<
    { id: string; name: string; destination: { id: string; name: string } }[]
  >('crossings.json');
  const feeSeed = readSeed<
    { crossingId: string; kind: string; priceDkk: number; validFrom: string; source: string }[]
  >('crossing-fees.json');

  db.transaction((tx) => {
    for (const c of crossingSeed) {
      tx.insert(crossings).values({ id: c.id, name: c.name }).run();
      tx.insert(destinations).values({ ...c.destination, crossingId: c.id }).run();
    }
    for (const fee of feeSeed) tx.insert(crossingFees).values(fee).run();
  });
}
