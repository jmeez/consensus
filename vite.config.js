import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // The Claude proxy lives in server/index.mjs so the API key never
      // reaches the browser. `npm run dev` starts both processes.
      '/api': 'http://localhost:8787',
    },
  },
});
