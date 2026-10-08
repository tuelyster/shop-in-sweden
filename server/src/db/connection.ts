import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema>;

const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const defaultDatabasePath = resolve(serverDir, '../data/shop-in-sweden.db');

/** Opens a SQLite database (':memory:' or a file path) and applies migrations. */
export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = drizzle(new Database(path), { schema });
  migrate(db, { migrationsFolder: resolve(serverDir, 'drizzle') });
  return db;
}
