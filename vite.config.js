import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server can proxy /api to any backend so local work never needs a
// code change: set VITE_DEV_API_PROXY=http://localhost:3000 and the app's
// relative /api calls hit your local gcr-api-clean instead of production.
export default defineConfig(({ mode }) => {
  const proxyTarget = process.env.VITE_DEV_API_PROXY;
  const paperclip = process.env.PAPERCLIP_DEV_SERVER || 'http://localhost:3100';
  const proxy = {
    '/api/paperclip': {
      target: paperclip,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/paperclip/, '/api'),
    },
  };
  if (proxyTarget) {
    proxy['/api'] = { target: proxyTarget, changeOrigin: true, secure: false };
  }

  return {
    plugins: [react()],
    server: {
      port: Number(process.env.PORT) || 5173,
      proxy,
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 900,
    },
  };
});
