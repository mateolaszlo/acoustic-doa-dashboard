import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isTest = mode === 'test' || Boolean(process.env.VITEST);

  const backendTarget =
    env.VITE_BACKEND_HTTPS_URL ||
    process.env.VITE_BACKEND_HTTPS_URL ||
    env.VITE_BACKEND_HTTP_URL ||
    process.env.VITE_BACKEND_HTTP_URL ||
    '';

  if (command === 'serve' && !isTest && !backendTarget) {
    throw new Error(
      '[FATAL] Missing VITE_BACKEND_HTTPS_URL in acoustic-doa-dashboard/.env (copy .env.example to .env and set e.g. VITE_BACKEND_HTTPS_URL=https://localhost:3443)'
    );
  }

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
