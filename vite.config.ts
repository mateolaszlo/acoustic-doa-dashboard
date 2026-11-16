import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { ensureTlsCertificates } from './certs/ensure_certs.mjs';

function resolveHttpsOptions(
  env: Record<string, string>,
  shouldServeHttps: boolean
): { key: Buffer; cert: Buffer } | undefined {
  if (!shouldServeHttps) {
    return undefined;
  }

  const enableRaw = (env.VITE_ENABLE_HTTPS || process.env.VITE_ENABLE_HTTPS || '').trim().toLowerCase();
  if (enableRaw === 'false' || enableRaw === '0') {
    return undefined;
  }

  const keyPathRaw =
    env.VITE_SSL_KEY_PATH ||
    process.env.VITE_SSL_KEY_PATH ||
    './certs/server.key';
  const certPathRaw =
    env.VITE_SSL_CERT_PATH ||
    process.env.VITE_SSL_CERT_PATH ||
    './certs/server.cert';

  const keyPath = path.resolve(process.cwd(), keyPathRaw);
  const certPath = path.resolve(process.cwd(), certPathRaw);

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    try {
      ensureTlsCertificates({ keyPath, certPath });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (enableRaw === 'true') {
        throw new Error(
          `[FATAL] VITE_ENABLE_HTTPS=true but TLS certificate setup failed: ${msg}`
        );
      }
      console.warn(`[HTTPS] Notice: Could not auto-generate TLS certificates (${msg}); continuing in HTTP mode.`);
      return undefined;
    }
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

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

  const httpsOptions = resolveHttpsOptions(env, command === 'serve' && !isTest);

  return {
    plugins: [react()],
    server: {
      port: 5173,
      ...(httpsOptions ? { https: httpsOptions } : {}),
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    ...(httpsOptions ? { preview: { https: httpsOptions } } : {}),
  };
});
