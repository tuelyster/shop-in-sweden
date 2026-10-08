import { defineConfig, devices } from '@playwright/test';

// Dedicated ports and database so the smoke test never clashes with `npm run dev`.
// Ports and database path can be overridden (E2E_CLIENT_PORT, E2E_API_PORT, E2E_DATABASE_PATH)
// so several checkouts can run the smoke test side by side.
const clientPort = Number(process.env.E2E_CLIENT_PORT ?? 5174);
const apiPort = Number(process.env.E2E_API_PORT ?? 3101);

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: `http://localhost:${clientPort}` },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'npm run seed && npm run dev',
    url: `http://localhost:${clientPort}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_PATH: process.env.E2E_DATABASE_PATH ?? 'data/e2e.db',
      PORT: String(apiPort),
      API_PORT: String(apiPort),
      CLIENT_PORT: String(clientPort),
    },
  },
});
