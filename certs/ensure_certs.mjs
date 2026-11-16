import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MINIMAL_OPENSSL_CNF = `[req]
prompt = no
distinguished_name = dn
x509_extensions = v3_req

[dn]
C = SI
O = Acoustic DOA
CN = localhost

[v3_req]
subjectAltName = DNS:localhost,IP:127.0.0.1
basicConstraints = CA:FALSE
keyUsage = digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
`;

function findOpenSslBinary() {
  const candidates = [];
  if (process.platform === 'win32') {
    // Prefer Git for Windows OpenSSL first when present, then PATH
    candidates.push(
      'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
      'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
      'C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe',
      'openssl'
    );
  } else {
    candidates.push('openssl');
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

const DEFAULT_CERTS_DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * Ensures local self-signed SAN TLS certificates exist at keyPath and certPath.
 * Uses an explicit temporary OpenSSL config file so Windows builds with a
 * missing compiled-in OPENSSLDIR (e.g. Z:/extlib/.../ssl/openssl.cnf) still succeed.
 */
export function ensureTlsCertificates({
  keyPath = path.join(DEFAULT_CERTS_DIR, 'server.key'),
  certPath = path.join(DEFAULT_CERTS_DIR, 'server.cert'),
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

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acoustic-doa-cert-'));
  const tmpConfigPath = path.join(tmpDir, 'openssl.cnf');
  fs.writeFileSync(tmpConfigPath, MINIMAL_OPENSSL_CNF, 'utf8');

  logger.log('[HTTPS] No TLS certificates detected; generating local self-signed SAN certificates...');
  try {
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
        '-config',
        tmpConfigPath,
      ],
      {
        env: {
          ...process.env,
          OPENSSL_CONF: tmpConfigPath,
          MSYS_NO_PATHCONV: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup failures
    }
  }

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
