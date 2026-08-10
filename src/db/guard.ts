import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Extracts the database name from a PostgreSQL connection string or database URL.
 */
export function extractDatabaseName(connectionString: string): string {
  if (!connectionString) return '';
  try {
    const url = new URL(connectionString);
    const pathname = url.pathname.replace(/^\//, '');
    return pathname;
  } catch {
    const match = connectionString.match(/\/([^/?]+)(\?|$)/);
    return match ? match[1] : '';
  }
}

/**
 * Checks if the database name ends with `_test`.
 */
export function isTestDatabase(connectionString: string): boolean {
  const dbName = extractDatabaseName(connectionString);
  return dbName.endsWith('_test');
}

/**
 * Safety Guard: Enforces that destructive test/seed operations target only a database ending in `_test`.
 * Throws an Error if the target database name does not end with `_test`.
 */
export function assertTestDatabase(connectionString: string): void {
  const dbName = extractDatabaseName(connectionString);
  if (!dbName || !dbName.endsWith('_test')) {
    throw new Error(
      `Safety Guard Violation: Destructive operation refused. Target database "${dbName || 'unknown'}" does not end with '_test'.`
    );
  }
}
