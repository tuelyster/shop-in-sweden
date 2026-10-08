import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiPort = process.env.API_PORT ?? '3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.CLIENT_PORT ?? 5173),
    strictPort: true,
    proxy: { '/api': `http://localhost:${apiPort}` },
  },
});
