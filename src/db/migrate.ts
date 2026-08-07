import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { db, isPgLite } from './index';
import * as dotenv from 'dotenv';

dotenv.config();

export async function runMigrations() {
  console.log('Running migrations...');
  if (isPgLite) {
    await migratePglite(db as any, { migrationsFolder: './drizzle' });
  } else {
    await migratePg(db as any, { migrationsFolder: './drizzle' });
  }
  console.log('Migrations completed successfully.');
}

if (require.main === module || (typeof process !== 'undefined' && process.argv[1]?.includes('migrate'))) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
