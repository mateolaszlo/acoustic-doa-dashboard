import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendTarget =
    env.VITE_BACKEND_HTTPS_URL ||
    process.env.VITE_BACKEND_HTTPS_URL ||
    env.VITE_BACKEND_HTTP_URL ||
    process.env.VITE_BACKEND_HTTP_URL ||
    'https://localhost:3443';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
