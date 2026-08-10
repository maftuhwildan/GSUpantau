import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../db';
import { assertTestDatabase, isTestDatabase, extractDatabaseName } from '../db/guard';
import { runMigrations } from '../db/migrate';
import { runSeed } from '../db/seed';
import * as schema from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { GET as healthHandler } from '../app/api/health/route';

describe('PostgreSQL Integration & Concurrency Safety (Batch 20)', () => {
  beforeAll(async () => {
    // 1. Verify safety guard
    const testUrl = process.env.DATABASE_TEST_URL || process.env.DATABASE_URL || '';
    assertTestDatabase(testUrl);

    // 2. Ensure migrations and seed run against PostgreSQL test DB
    await runMigrations();
    await runSeed();
  }, 60_000);

  it('enforces safety guard on non-test database names', () => {
    expect(isTestDatabase('postgres://poultry:poultry@localhost:5432/poultry_receiving_test')).toBe(true);
    expect(extractDatabaseName('postgres://poultry:poultry@localhost:5432/poultry_receiving_test')).toBe('poultry_receiving_test');

    expect(isTestDatabase('postgres://poultry:poultry@localhost:5432/poultry_receiving')).toBe(false);
    expect(() => assertTestDatabase('postgres://poultry:poultry@localhost:5432/poultry_receiving')).toThrow(
      /Safety Guard Violation/i
    );
    expect(() => assertTestDatabase('postgres://poultry:poultry@localhost:5432/poultry_receiving_prod')).toThrow(
      /Safety Guard Violation/i
    );
  });

  it('rejects concurrent session starts on the same line under PostgreSQL', async () => {
    const lineCode = `LINE-CONC-${Date.now()}`;
    const [testLine] = await db.insert(schema.lines).values({
      lineCode,
      name: 'Jalur Test Concurrency 1',
      status: 'ACTIVE',
    }).returning();

    const [adminUser] = await db.select().from(schema.users).limit(1);

    const [rec1] = await db.insert(schema.receivings).values({
      receivingNumber: `REC-CONC-1-${Date.now()}`,
      deliveryNoteNumber: `DN-CONC-1-${Date.now()}`,
      receivingDate: '2026-08-07',
      licensePlateSnapshot: 'B 1111 CONC',
      driverNameSnapshot: 'Driver 1',
      supplierNameSnapshot: 'Supplier 1',
      manifestCount: 1000,
      lineId: testLine.id,
      status: 'WAITING',
      createdBy: adminUser.id,
    }).returning();

    const [rec2] = await db.insert(schema.receivings).values({
      receivingNumber: `REC-CONC-2-${Date.now()}`,
      deliveryNoteNumber: `DN-CONC-2-${Date.now()}`,
      receivingDate: '2026-08-07',
      licensePlateSnapshot: 'B 2222 CONC',
      driverNameSnapshot: 'Driver 2',
      supplierNameSnapshot: 'Supplier 2',
      manifestCount: 1000,
      lineId: testLine.id,
      status: 'WAITING',
      createdBy: adminUser.id,
    }).returning();

    // Attempt two simultaneous starts on testLine
    const start1 = db.insert(schema.receivingSessions).values({
      receivingId: rec1.id,
      lineId: testLine.id,
      status: 'COUNTING',
      startedBy: adminUser.id,
    });

    const start2 = db.insert(schema.receivingSessions).values({
      receivingId: rec2.id,
      lineId: testLine.id,
      status: 'COUNTING',
      startedBy: adminUser.id,
    });

    const results = await Promise.allSettled([start1, start2]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const activeSessions = await db.select()
      .from(schema.receivingSessions)
      .where(and(eq(schema.receivingSessions.lineId, testLine.id), eq(schema.receivingSessions.status, 'COUNTING')));

    expect(activeSessions.length).toBe(1);

    // Clean up
    await db.delete(schema.receivingSessions).where(eq(schema.receivingSessions.lineId, testLine.id));
    await db.delete(schema.receivings).where(eq(schema.receivings.id, rec1.id));
    await db.delete(schema.receivings).where(eq(schema.receivings.id, rec2.id));
    await db.delete(schema.lines).where(eq(schema.lines.id, testLine.id));
  });

  it('rejects concurrent session starts for the same receiving across multiple lines', async () => {
    const timeSuffix = Date.now();
    const [lineA] = await db.insert(schema.lines).values({
      lineCode: `LINE-REC-A-${timeSuffix}`,
      name: 'Jalur Rec A',
      status: 'ACTIVE',
    }).returning();

    const [lineB] = await db.insert(schema.lines).values({
      lineCode: `LINE-REC-B-${timeSuffix}`,
      name: 'Jalur Rec B',
      status: 'ACTIVE',
    }).returning();

    const [adminUser] = await db.select().from(schema.users).limit(1);

    const [receiving] = await db.insert(schema.receivings).values({
      receivingNumber: `REC-SINGLE-${timeSuffix}`,
      deliveryNoteNumber: `DN-SINGLE-${timeSuffix}`,
      receivingDate: '2026-08-07',
      licensePlateSnapshot: 'B 3333 CONC',
      driverNameSnapshot: 'Driver 3',
      supplierNameSnapshot: 'Supplier 3',
      manifestCount: 1500,
      status: 'WAITING',
      createdBy: adminUser.id,
    }).returning();

    const startOnA = db.insert(schema.receivingSessions).values({
      receivingId: receiving.id,
      lineId: lineA.id,
      status: 'COUNTING',
      startedBy: adminUser.id,
    });

    const startOnB = db.insert(schema.receivingSessions).values({
      receivingId: receiving.id,
      lineId: lineB.id,
      status: 'COUNTING',
      startedBy: adminUser.id,
    });

    const results = await Promise.allSettled([startOnA, startOnB]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const activeForRec = await db.select()
      .from(schema.receivingSessions)
      .where(and(eq(schema.receivingSessions.receivingId, receiving.id), eq(schema.receivingSessions.status, 'COUNTING')));

    expect(activeForRec.length).toBe(1);

    await db.delete(schema.receivingSessions).where(eq(schema.receivingSessions.receivingId, receiving.id));
    await db.delete(schema.receivings).where(eq(schema.receivings.id, receiving.id));
    await db.delete(schema.lines).where(eq(schema.lines.id, lineA.id));
    await db.delete(schema.lines).where(eq(schema.lines.id, lineB.id));
  });

  it('correctly handles event assignment before and after session finish', async () => {
    const timeSuffix = Date.now();
    const [line] = await db.insert(schema.lines).values({
      lineCode: `LINE-FINISH-${timeSuffix}`,
      name: 'Jalur Session Finish',
      status: 'ACTIVE',
    }).returning();

    const [adminUser] = await db.select().from(schema.users).limit(1);

    const [rec] = await db.insert(schema.receivings).values({
      receivingNumber: `REC-FINISH-${timeSuffix}`,
      deliveryNoteNumber: `DN-FINISH-${timeSuffix}`,
      receivingDate: '2026-08-07',
      licensePlateSnapshot: 'B 4444 FINISH',
      driverNameSnapshot: 'Driver Finish',
      supplierNameSnapshot: 'Supplier Finish',
      manifestCount: 1000,
      lineId: line.id,
      status: 'COUNTING',
      createdBy: adminUser.id,
    }).returning();

    const [session] = await db.insert(schema.receivingSessions).values({
      receivingId: rec.id,
      lineId: line.id,
      status: 'COUNTING',
      startedBy: adminUser.id,
    }).returning();

    const [device] = await db.select().from(schema.devices).limit(1);

    // Event committed BEFORE finish -> ASSIGNED
    const [event1] = await db.insert(schema.sensorEvents).values({
      eventId: `EVT-PG-FINISH-1-${timeSuffix}`,
      bootId: `boot-pg-finish-${timeSuffix}`,
      deviceId: device.id,
      lineId: line.id,
      sequence: 1,
      eventType: 'DETECTION',
      deviceTime: new Date(),
      sessionId: session.id,
      assignmentStatus: 'ASSIGNED',
      eventMode: 'PRODUCTION',
      rawPayload: {},
    }).returning();

    expect(event1.assignmentStatus).toBe('ASSIGNED');
    expect(event1.sessionId).toBe(session.id);

    // Finish session
    await db.update(schema.receivingSessions)
      .set({ status: 'COMPLETED', finishedAt: new Date(), finishedBy: adminUser.id })
      .where(eq(schema.receivingSessions.id, session.id));

    // Event committed AFTER finish -> UNASSIGNED
    const [event2] = await db.insert(schema.sensorEvents).values({
      eventId: `EVT-PG-FINISH-2-${timeSuffix}`,
      bootId: `boot-pg-finish-${timeSuffix}`,
      deviceId: device.id,
      lineId: line.id,
      sequence: 2,
      eventType: 'DETECTION',
      deviceTime: new Date(),
      sessionId: null,
      assignmentStatus: 'UNASSIGNED',
      eventMode: 'PRODUCTION',
      rawPayload: {},
    }).returning();

    expect(event2.assignmentStatus).toBe('UNASSIGNED');
    expect(event2.sessionId).toBeNull();

    // Clean up
    await db.delete(schema.sensorEvents).where(eq(schema.sensorEvents.id, event1.id));
    await db.delete(schema.sensorEvents).where(eq(schema.sensorEvents.id, event2.id));
    await db.delete(schema.receivingSessions).where(eq(schema.receivingSessions.id, session.id));
    await db.delete(schema.receivings).where(eq(schema.receivings.id, rec.id));
    await db.delete(schema.lines).where(eq(schema.lines.id, line.id));
  });

  it('returns valid health status from GET /api/health against PostgreSQL', async () => {
    const res = await healthHandler();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.1.0');
    expect(body.checks.database.status).toBe('ok');
    expect(body.checks.migrations.status).toBe('ok');
    expect(body.checks.websocket.status).toBe('ok');
    expect(body.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
