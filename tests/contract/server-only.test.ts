/**
 * Database reads and payment code must never be bundled for the browser.
 * Every module that touches them is marked `server-only` (importing it from a
 * client component is then a build error), and no client component imports
 * one directly - this catches it in a second instead of a full build.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.(ts|tsx)$/.test(entry.name) ? [rel] : [];
  });
}

const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Modules that hold secrets or query the database for server components. */
const SERVER_ONLY = [
  ...sourceFiles('lib/data'),
  path.join('lib', 'orders.ts'),
  path.join('lib', 'payments.ts'),
];

/** Import specifiers a client component must not use. */
const FORBIDDEN = [/^@\/lib\/data(\/|$)/, /^@\/lib\/orders$/, /^@\/lib\/payments$/, /^@\/lib\/stripe$/, /^@\/db\//];

describe('server-only boundary', () => {
  it.each(SERVER_ONLY)('%s is marked server-only', (file) => {
    expect(read(file)).toMatch(/^import 'server-only';/m);
  });

  it('AUT-12: no client component imports server-only code', () => {
    const clientFiles = ['app', 'components', 'hooks']
      .flatMap(sourceFiles)
      .filter((file) => /^\s*['"]use client['"]/.test(read(file)));
    expect(clientFiles.length).toBeGreaterThan(10); // the scan found the client components

    const offenders = clientFiles.flatMap((file) =>
      [...read(file).matchAll(/from\s+['"]([^'"]+)['"]/g)]
        .map((match) => match[1])
        .filter((specifier) => FORBIDDEN.some((pattern) => pattern.test(specifier)))
        .map((specifier) => `${file} imports ${specifier}`)
    );

    expect(offenders).toEqual([]);
  });
});
