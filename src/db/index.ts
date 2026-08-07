import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://poultry:poultry@localhost:5432/poultry_receiving';
export const isPgLite = process.env.USE_PGLITE === 'true' || connectionString.startsWith('memory://');

let pgliteInstance: PGlite | null = null;

function createDbClient() {
  if (isPgLite) {
    pgliteInstance = pgliteInstance || new PGlite();
    return drizzlePglite(pgliteInstance, { schema });
  } else {
    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 3000,
    });
    return drizzlePg(pool, { schema });
  }
}

export const db = createDbClient();
export type DbClient = typeof db;
