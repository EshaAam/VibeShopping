/**
 * Playwright's webServer: a throwaway Postgres, the real migrations, then the
 * production build of the app pointed at it.
 *
 * - Postgres runs in Docker with its data in memory (tmpfs); nothing is
 *   written to disk and the image (postgres:16-alpine) is reused.
 * - The app keeps its Stripe test keys from .env, but gets no Gemini keys, so
 *   the chat takes its deterministic no-AI path and spends no quota.
 * - Requires `npm run build` first.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CONTAINER = 'vibe-e2e-db';
const DB_PORT = 54329;
const APP_PORT = process.env.E2E_PORT ?? '3100';
const DATABASE_URL = `postgresql://postgres:e2e@127.0.0.1:${DB_PORT}/postgres`;

const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: 'pipe' });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!fs.existsSync(path.join(ROOT, '.next', 'BUILD_ID'))) {
  console.error('[e2e] No production build found. Run `npm run build` first.');
  process.exit(1);
}

// One fixed name, so a crashed run leaves at most one container behind
try {
  docker('rm', '-f', CONTAINER);
} catch {}
docker(
  'run', '-d', '--rm', '--name', CONTAINER,
  '--tmpfs', '/var/lib/postgresql/data',
  '-e', 'POSTGRES_PASSWORD=e2e',
  '-p', `${DB_PORT}:5432`,
  'postgres:16-alpine'
);

// The image starts Postgres twice (init, then for real); wait for the second
for (let i = 0; ; i++) {
  // Postgres logs to stderr
  const { stdout, stderr } = spawnSync('docker', ['logs', CONTAINER], { encoding: 'utf8' });
  const logs = `${stdout}${stderr}`;
  if ((logs.match(/database system is ready to accept connections/g) ?? []).length >= 2) break;
  if (i > 120) throw new Error('[e2e] Postgres did not start');
  await sleep(250);
}

execFileSync(process.execPath, [path.join(ROOT, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
  cwd: ROOT,
  env: { ...process.env, DATABASE_URL },
  stdio: 'inherit',
});

const app = spawn(
  process.execPath,
  [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'start', '-p', APP_PORT],
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL,
      DATABASE_DRIVER: 'pg',
      NEXTAUTH_URL: `http://localhost:${APP_PORT}`,
      NEXTAUTH_URL_INTERNAL: `http://localhost:${APP_PORT}`,
      AUTH_TRUST_HOST: 'true',
      GEMINI_API_KEYS: '',
      GEMINI_API_KEY: '',
      STRIPE_WEBHOOK_SECRET: 'whsec_e2e_test_secret',
    },
  }
);

const stop = () => {
  app.kill();
  try {
    docker('rm', '-f', CONTAINER);
  } catch {}
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
app.on('exit', (code) => {
  stop();
  process.exit(code ?? 0);
});
