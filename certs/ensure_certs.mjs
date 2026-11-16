import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function findOpenSslBinary() {
  const candidates = ['openssl'];
  if (process.platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
      'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
      'C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe'
    );
  }

  for (const bin of candidates) {
    try {
      execFileSync(bin, ['version'], { stdio: 'ignore' });
      return bin;
    } catch {
      // Try next candidate
    }
  }

  return null;
}

function certHasLocalhostSan(opensslBin, certPath) {
  try {
    const out = execFileSync(opensslBin, ['x509', '-in', certPath, '-noout', '-ext', 'subjectAltName'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.includes('DNS:localhost');
  } catch {
    return false;
  }
}

/**
 * Ensures local self-signed SAN TLS certificates exist at keyPath and certPath.
 * Generates them automatically via OpenSSL if missing (or when force=true / lacking SAN).
 */
export function ensureTlsCertificates({
  keyPath = path.resolve(process.cwd(), 'certs/server.key'),
  certPath = path.resolve(process.cwd(), 'certs/server.cert'),
  force = false,
  logger = console,
} = {}) {
  const keyExists = fs.existsSync(keyPath);
  const certExists = fs.existsSync(certPath);

  if (!force && keyExists && certExists) {
    const opensslBin = findOpenSslBinary();
    if (!opensslBin || certHasLocalhostSan(opensslBin, certPath)) {
      return { generated: false, keyPath, certPath };
    }
    logger.log('[HTTPS] Existing dashboard certificate lacks SAN extensions; regenerating...');
  }

  const opensslBin = findOpenSslBinary();
  if (!opensslBin) {
    throw new Error(
      'OpenSSL executable not found in PATH. Install OpenSSL (or Git for Windows) or run `bash certs/generate_certs.sh`.'
    );
  }

  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.mkdirSync(path.dirname(certPath), { recursive: true });

  logger.log('[HTTPS] No TLS certificates detected; generating local self-signed SAN certificates...');
  execFileSync(
    opensslBin,
    [
      'req',
      '-nodes',
      '-new',
      '-x509',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '365',
      '-subj',
      '/C=SI/O=Acoustic DOA/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
      '-addext',
      'basicConstraints=CA:FALSE',
      '-addext',
      'keyUsage=digitalSignature,keyEncipherment',
      '-addext',
      'extendedKeyUsage=serverAuth',
    ],
    {
      env: { ...process.env, MSYS_NO_PATHCONV: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  try {
    fs.chmodSync(keyPath, 0o600);
  } catch {
    // Windows NTFS ignores POSIX chmod
  }

  logger.log(`[HTTPS] Generated dashboard TLS certificates at ${keyPath} and ${certPath}`);
  return { generated: true, keyPath, certPath };
}

const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const force = process.argv.includes('--force');
  try {
    const result = ensureTlsCertificates({ force });
    if (!result.generated) {
      console.log(`Certificates already exist with SAN extensions at ${result.certPath}`);
    }
  } catch (err) {
    console.error(`[FATAL] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
