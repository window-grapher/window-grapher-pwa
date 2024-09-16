import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // butter-lib 内の webpack.config.js を無視するエイリアスを設定
      'butter-lib/webpack.config.js': '/empty-module',
    },
  },
  optimizeDeps: {
    exclude: ['butter-lib'],
  },
  build: {
    rollupOptions: {
      external: ['butter-lib/webpack.config.js'],
    },
    commonjsOptions: {
      ignore: ['butter-lib/webpack.config.js'],
    },
    target: 'esnext',
  },
  define: {
    global: 'globalThis',
  },
  server: {
    port: 3000,
  },
});
