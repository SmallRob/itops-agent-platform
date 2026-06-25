import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@services': path.resolve(__dirname, 'src/services'),
      '@services/agent': path.resolve(__dirname, 'src/services/agent'),
      '@services/alert': path.resolve(__dirname, 'src/services/alert'),
      '@services/ai': path.resolve(__dirname, 'src/services/ai'),
      '@services/network': path.resolve(__dirname, 'src/services/network'),
      '@services/server': path.resolve(__dirname, 'src/services/server'),
      '@services/database': path.resolve(__dirname, 'src/services/database'),
      '@services/workflow': path.resolve(__dirname, 'src/services/workflow'),
      '@services/report': path.resolve(__dirname, 'src/services/report'),
      '@services/knowledge': path.resolve(__dirname, 'src/services/knowledge'),
      '@services/notification': path.resolve(__dirname, 'src/services/notification'),
      '@services/security': path.resolve(__dirname, 'src/services/security'),
      '@services/audit': path.resolve(__dirname, 'src/services/audit'),
      '@services/backup': path.resolve(__dirname, 'src/services/backup'),
      '@services/monitor': path.resolve(__dirname, 'src/services/monitor'),
      '@services/foundation': path.resolve(__dirname, 'src/services/foundation'),
      '@models': path.resolve(__dirname, 'src/models'),
      '@routes': path.resolve(__dirname, 'src/routes'),
      '@middleware': path.resolve(__dirname, 'src/middleware'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@types': path.resolve(__dirname, 'src/types'),
      '@websocket': path.resolve(__dirname, 'src/websocket'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.d.ts',
        'src/types/'
      ]
    }
  }
});
