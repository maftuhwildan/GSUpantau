import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import { assertTestDatabase } from './guard';

dotenv.config();

export const isPgTest = process.env.IS_PG_TEST === 'true';

export const connectionString = (isPgTest && process.env.DATABASE_TEST_URL)
  ? process.env.DATABASE_TEST_URL
  : (process.env.DATABASE_URL || 'postgres://poultry:poultry@localhost:5432/poultry_receiving');

export const isPgLite = process.env.USE_PGLITE === 'true' || connectionString.startsWith('memory://');

let pgliteInstance: PGlite | null = null;
let pgPoolInstance: Pool | null = null;

export function getPgPool(): Pool {
  if (!pgPoolInstance) {
    pgPoolInstance = new Pool({
      connectionString,
      connectionTimeoutMillis: 5000,
    });
  }
  return pgPoolInstance;
}

function createDbClient() {
  if (isPgLite) {
    pgliteInstance = pgliteInstance || new PGlite();
    return drizzlePglite(pgliteInstance, { schema });
  } else {
    if (isPgTest) {
      assertTestDatabase(connectionString);
    }
    const pool = getPgPool();
    return drizzlePg(pool, { schema });
  }
}

export const db = createDbClient();
export type DbClient = typeof db;
