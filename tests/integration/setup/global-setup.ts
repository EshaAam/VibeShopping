/**
 * Starts one Postgres for the whole integration run and builds a template
 * database from the real migrations. Each test file then clones the template
 * (see helpers/db.ts), so files run in parallel without sharing data.
 *
 * Set TEST_DATABASE_URL to use an existing server (e.g. a CI service
 * container) instead of starting one with Docker.
 */
import { Client } from 'pg';
import type { TestProject } from 'vitest/node';
import { applyMigrations } from './migrations';

export const TEMPLATE_DB = 'vibe_template';

declare module 'vitest' {
  export interface ProvidedContext {
    pgAdminUrl: string;
  }
}

async function startContainer() {
  // Nothing is pulled or written to disk: postgres:16-alpine is reused, its
  // data lives in memory, and the reaper container is skipped (we stop it below).
  process.env.TESTCONTAINERS_RYUK_DISABLED ??= 'true';
  const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withTmpFs({ '/var/lib/postgresql/data': 'rw' })
    .start();
  return { url: container.getConnectionUri(), stop: () => container.stop() };
}

export default async function setup(project: TestProject) {
  const server = process.env.TEST_DATABASE_URL
    ? { url: process.env.TEST_DATABASE_URL, stop: async () => {} }
    : await startContainer();

  const admin = new Client({ connectionString: server.url });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEMPLATE_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEMPLATE_DB}`);
  await admin.end();

  const templateUrl = new URL(server.url);
  templateUrl.pathname = `/${TEMPLATE_DB}`;
  const template = new Client({ connectionString: templateUrl.toString() });
  await template.connect();
  await applyMigrations(template);
  await template.end();

  project.provide('pgAdminUrl', server.url);

  return async () => {
    await server.stop();
  };
}
