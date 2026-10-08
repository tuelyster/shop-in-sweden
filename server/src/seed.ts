import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './db/connection';
import { crossingFees, crossings, destinations, seasons, vehicleDefaults } from './db/schema';

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
    {
      crossingId: string;
      kind: string;
      priceDkk: number;
      agreement: string;
      season: string | null;
      bracket: string | null;
      validFrom: string;
      source: string;
    }[]
  >('crossing-fees.json');
  const seasonSeed = readSeed<
    { id: string; startMonthDay: string; endMonthDay: string; source: string }[]
  >('seasons.json');

  const vehicleSeed = readSeed<(typeof vehicleDefaults.$inferInsert)[]>('vehicle-defaults.json');

  db.transaction((tx) => {
    for (const v of vehicleSeed) tx.insert(vehicleDefaults).values(v).run();
    for (const c of crossingSeed) {
      tx.insert(crossings).values({ id: c.id, name: c.name }).run();
      tx.insert(destinations).values({ ...c.destination, crossingId: c.id }).run();
    }
    for (const s of seasonSeed) tx.insert(seasons).values(s).run();
    for (const fee of feeSeed) tx.insert(crossingFees).values(fee).run();
  });
}
