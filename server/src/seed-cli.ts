import { rmSync } from 'node:fs';
import { defaultDatabasePath, openDatabase } from './db/connection';
import { seedDatabase } from './seed';

const path = process.env.DATABASE_PATH ?? defaultDatabasePath;
for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(path + suffix, { force: true });
seedDatabase(openDatabase(path));
console.log(`Seeded fresh database at ${path}`);
