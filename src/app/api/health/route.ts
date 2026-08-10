import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { wsBroadcaster } from '@/lib/ws';

export async function GET() {
  const startTime = Date.now();
  let dbStatus: 'ok' | 'error' = 'ok';
  let dbLatencyMs = 0;
  let dbError: string | undefined;

  try {
    await db.execute(sql`SELECT 1`);
    dbLatencyMs = Date.now() - startTime;
  } catch (err: unknown) {
    dbStatus = 'error';
    dbError = err instanceof Error ? err.message : String(err);
  }

  let migrationStatus: 'ok' | 'error' = 'ok';
  let appliedCount = 0;
  let migrationError: string | undefined;

  if (dbStatus === 'ok') {
    try {
      let result: any;
      try {
        result = await db.execute(sql`SELECT COUNT(*)::int as count FROM "drizzle"."__drizzle_migrations"`);
      } catch {
        result = await db.execute(sql`SELECT COUNT(*)::int as count FROM __drizzle_migrations`);
      }
      const rows = (result as any).rows || result;
      appliedCount = Number(rows[0]?.count ?? 0);
    } catch (err: unknown) {
      migrationStatus = 'error';
      migrationError = err instanceof Error ? err.message : String(err);
    }
  } else {
    migrationStatus = 'error';
    migrationError = 'Database unreachable';
  }

  let wsStatus: 'ok' | 'error' = 'ok';
  let activeClients = 0;

  try {
    activeClients = wsBroadcaster.getClientCount();
  } catch (err: unknown) {
    wsStatus = 'error';
  }

  const isHealthy = dbStatus === 'ok' && wsStatus === 'ok' && migrationStatus === 'ok';

  return NextResponse.json(
    {
      status: isHealthy ? 'ok' : 'error',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      checks: {
        app: {
          status: 'ok',
        },
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          ...(dbError ? { error: dbError } : {}),
        },
        migrations: {
          status: migrationStatus,
          appliedCount,
          ...(migrationError ? { error: migrationError } : {}),
        },
        websocket: {
          status: wsStatus,
          activeClients,
        },
      },
    },
    { status: isHealthy ? 200 : 503 }
  );
}
