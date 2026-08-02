import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server can proxy /api to any backend so local work never needs a
// code change: set VITE_DEV_API_PROXY=http://localhost:3000 and the app's
// relative /api calls hit your local gcr-api-clean instead of production.
export default defineConfig(({ mode }) => {
  const proxyTarget = process.env.VITE_DEV_API_PROXY;

  return {
    plugins: [react()],
    server: {
      port: Number(process.env.PORT) || 5173,
      proxy: proxyTarget
        ? {
            '/api': {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
            },
          }
        : undefined,
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 900,
    },
  };
});
