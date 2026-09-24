import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: ['localhost', '127.0.0.1', 'itops-dev-frontend', 'itops.leansoftx.com', '.leansoftx.com'],
    proxy: {
      '/api': {
        target: process.env.DOCKER_MODE ? 'http://backend:3001' : 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: process.env.DOCKER_MODE ? 'http://backend:3001' : 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
