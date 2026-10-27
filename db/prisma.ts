import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';
import ws from 'ws';
import { createPrisma } from './client';

const connectionString = process.env.DATABASE_URL;
// console.log("DATABASE_URL", connectionString);

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Neon's serverless driver in production. DATABASE_DRIVER=pg talks to plain
// Postgres instead - the throwaway database the e2e tests run the app against.
function createAdapter(url: string) {
  if (process.env.DATABASE_DRIVER === 'pg') {
    return new PrismaPg({ connectionString: url });
  }
  // Sets up WebSocket connections, which enables Neon to use WebSocket communication.
  neonConfig.webSocketConstructor = ws;
  return new PrismaNeon({ connectionString: url });
}

export const prisma = createPrisma(createAdapter(connectionString));
