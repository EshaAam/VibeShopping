/**
 * Order rows are a projection of the OrderEvent log, which only stays true if
 * every write goes through lib/orders.ts (it appends the event in the same
 * transaction). This fails if an order write shows up anywhere else.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const ALLOWED = path.join('lib', 'orders.ts');
const WRITE = /\.(order|orderEvent)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('order writes', () => {
  it('only happen in lib/orders.ts', () => {
    const offenders = ['app', 'components', 'lib']
      .flatMap((dir) => sourceFiles(path.join(ROOT, dir)))
      .filter((file) => path.relative(ROOT, file) !== ALLOWED)
      .flatMap((file) =>
        fs
          .readFileSync(file, 'utf8')
          .split('\n')
          .map((line, i) => ({ line, at: `${path.relative(ROOT, file)}:${i + 1}` }))
          .filter(({ line }) => WRITE.test(line))
          .map(({ at, line }) => `${at}  ${line.trim()}`)
      );

    expect(offenders).toEqual([]);
  });
});
