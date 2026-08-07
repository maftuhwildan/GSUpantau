import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../db';
import * as schema from '../db/schema';
import { runMigrations } from '../db/migrate';
import { runSeed } from '../db/seed';
import { eq } from 'drizzle-orm';

describe('Database Schema Invariants', () => {
  beforeAll(async () => {
    await runMigrations();
    await runSeed();
  });

  it('should enforce single active COUNTING session per line', async () => {
    // Create a new line for isolated testing
    const [testLine] = await db.insert(schema.lines).values({
      lineCode: `LINE-TEST-${Date.now()}`,
      name: 'Jalur Test Unique Index',
      status: 'ACTIVE',
    }).returning();

    const [user] = await db.select().from(schema.users).limit(1);
    expect(user).toBeDefined();

    const [rec1] = await db.insert(schema.receivings).values({
      receivingNumber: `TEST-REC-${Date.now()}-1`,
      deliveryNoteNumber: `TEST-DN-${Date.now()}-1`,
      receivingDate: '2026-08-07',
      licensePlateSnapshot: 'B 1111 TST',
      driverNameSnapshot: 'Test Driver 1',
      supplierNameSnapshot: 'Test Supplier 1',
      manifestCount: 1000,
      lineId: testLine.id,
      status: 'WAITING',
      createdBy: user.id,
    }).returning();

    const [rec2] = await db.insert(schema.receivings).values({
      receivingNumber: `TEST-REC-${Date.now()}-2`,
      deliveryNoteNumber: `TEST-DN-${Date.now()}-2`,
      receivingDate: '2026-08-07',
      licensePlateSnapshot: 'B 2222 TST',
      driverNameSnapshot: 'Test Driver 2',
      supplierNameSnapshot: 'Test Supplier 2',
      manifestCount: 1000,
      lineId: testLine.id,
      status: 'WAITING',
      createdBy: user.id,
    }).returning();

    // Insert first COUNTING session on testLine
    const [session1] = await db.insert(schema.receivingSessions).values({
      receivingId: rec1.id,
      lineId: testLine.id,
      status: 'COUNTING',
      startedBy: user.id,
    }).returning();

    expect(session1.status).toBe('COUNTING');

    // Attempting to insert a second COUNTING session on the same testLine MUST fail due to one_active_session_per_line
    await expect(
      db.insert(schema.receivingSessions).values({
        receivingId: rec2.id,
        lineId: testLine.id,
        status: 'COUNTING',
        startedBy: user.id,
      })
    ).rejects.toThrow(/one_active_session_per_line|unique constraint/i);

    // Clean up test records
    await db.delete(schema.receivingSessions).where(eq(schema.receivingSessions.id, session1.id));
    await db.delete(schema.receivings).where(eq(schema.receivings.id, rec1.id));
    await db.delete(schema.receivings).where(eq(schema.receivings.id, rec2.id));
    await db.delete(schema.lines).where(eq(schema.lines.id, testLine.id));
  });

  it('should enforce unique event_id and (device_id, sequence) on sensor_events', async () => {
    const [device] = await db.select().from(schema.devices).limit(1);
    const [line] = await db.select().from(schema.lines).limit(1);
    expect(device).toBeDefined();

    const testEventId = `TEST-EVT-${Date.now()}`;
    const testSeq = 99999;

    const [evt1] = await db.insert(schema.sensorEvents).values({
      eventId: testEventId,
      deviceId: device.id,
      lineId: line.id,
      sequence: testSeq,
      eventType: 'DETECTION',
      deviceTime: new Date(),
      assignmentStatus: 'UNASSIGNED',
      eventMode: 'PRODUCTION',
      rawPayload: { test: true },
    }).returning();

    expect(evt1.eventId).toBe(testEventId);

    // Duplicate event_id should throw
    await expect(
      db.insert(schema.sensorEvents).values({
        eventId: testEventId,
        deviceId: device.id,
        lineId: line.id,
        sequence: testSeq + 1,
        eventType: 'DETECTION',
        deviceTime: new Date(),
        assignmentStatus: 'UNASSIGNED',
        eventMode: 'PRODUCTION',
        rawPayload: { test: true },
      })
    ).rejects.toThrow();

    // Duplicate (deviceId, sequence) should throw
    await expect(
      db.insert(schema.sensorEvents).values({
        eventId: `${testEventId}-different`,
        deviceId: device.id,
        lineId: line.id,
        sequence: testSeq,
        eventType: 'DETECTION',
        deviceTime: new Date(),
        assignmentStatus: 'UNASSIGNED',
        eventMode: 'PRODUCTION',
        rawPayload: { test: true },
      })
    ).rejects.toThrow();

    // Clean up
    await db.delete(schema.sensorEvents).where(eq(schema.sensorEvents.id, evt1.id));
  });
});
