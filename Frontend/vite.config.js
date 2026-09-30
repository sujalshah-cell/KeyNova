import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dev-time proxy so the browser only ever talks to http://localhost:5173.
// /api and /socket.io are forwarded to the Express backend on :5000.
// Socket.io requires ws: true for WebSocket connections.
export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,

    proxy: {
      // REST API
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },

      // Socket.io / WebSocket
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },

  build: {
    // Build React frontend directly into Backend/public
    // so Express can serve the production frontend.
    outDir: path.resolve(__dirname, '../Backend/public'),

    // Remove the previous build before creating a new one.
    emptyOutDir: true,
  },
});