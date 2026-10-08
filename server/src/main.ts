import { serve } from '@hono/node-server';
import { createApp } from './app';
import { defaultDatabasePath, openDatabase } from './db/connection';

const port = Number(process.env.PORT ?? 3001);
const app = createApp(openDatabase(process.env.DATABASE_PATH ?? defaultDatabasePath));
serve({ fetch: app.fetch, port }, () => console.log(`Server listening on http://localhost:${port}`));
