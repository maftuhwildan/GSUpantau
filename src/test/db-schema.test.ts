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
  }, 30_000);

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

  it('should enforce single active COUNTING session per receiving across lines', async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const insertedLines = await db.insert(schema.lines).values([
      {
        lineCode: `LINE-REC-A-${suffix}`,
        name: 'Jalur Receiving A',
        status: 'ACTIVE',
      },
      {
        lineCode: `LINE-REC-B-${suffix}`,
        name: 'Jalur Receiving B',
        status: 'ACTIVE',
      },
    ]).returning();
    const [user] = await db.select().from(schema.users).limit(1);
    const [receiving] = await db.insert(schema.receivings).values({
      receivingNumber: `TEST-REC-UNIQUE-${suffix}`,
      deliveryNoteNumber: `TEST-DN-UNIQUE-${suffix}`,
      receivingDate: '2026-08-07',
      licensePlateSnapshot: 'B 3333 TST',
      driverNameSnapshot: 'Test Driver Unique',
      supplierNameSnapshot: 'Test Supplier Unique',
      manifestCount: 1000,
      status: 'WAITING',
      createdBy: user.id,
    }).returning();

    const [session] = await db.insert(schema.receivingSessions).values({
      receivingId: receiving.id,
      lineId: insertedLines[0].id,
      status: 'COUNTING',
      startedBy: user.id,
    }).returning();

    await expect(
      db.insert(schema.receivingSessions).values({
        receivingId: receiving.id,
        lineId: insertedLines[1].id,
        status: 'COUNTING',
        startedBy: user.id,
      })
    ).rejects.toThrow(/one_active_session_per_receiving|unique constraint/i);

    await db.delete(schema.receivingSessions).where(eq(schema.receivingSessions.id, session.id));
    await db.delete(schema.receivings).where(eq(schema.receivings.id, receiving.id));
    for (const line of insertedLines) {
      await db.delete(schema.lines).where(eq(schema.lines.id, line.id));
    }
  });

  it('should enforce unique event_id and boot-scoped device sequence on sensor_events', async () => {
    const [device] = await db.select().from(schema.devices).limit(1);
    const [line] = await db.select().from(schema.lines).limit(1);
    expect(device).toBeDefined();

    const testEventId = `TEST-EVT-${Date.now()}`;
    const testSeq = 99999;
    const testBootId = `TEST-BOOT-${Date.now()}`;

    const [evt1] = await db.insert(schema.sensorEvents).values({
      eventId: testEventId,
      bootId: testBootId,
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
        bootId: `${testBootId}-other`,
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

    // Duplicate (deviceId, bootId, sequence) should throw even if event_id differs
    await expect(
      db.insert(schema.sensorEvents).values({
        eventId: `${testEventId}-different`,
        bootId: testBootId,
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

    // The same sequence is valid again after a new device boot.
    const [evtAfterRestart] = await db.insert(schema.sensorEvents).values({
      eventId: `${testEventId}-new-boot`,
      bootId: `${testBootId}-restarted`,
      deviceId: device.id,
      lineId: line.id,
      sequence: testSeq,
      eventType: 'DETECTION',
      deviceTime: new Date(),
      assignmentStatus: 'UNASSIGNED',
      eventMode: 'PRODUCTION',
      rawPayload: { test: true },
    }).returning();

    expect(evtAfterRestart.sequence).toBe(testSeq);

    await expect(
      db.insert(schema.sensorEvents).values({
        eventId: `${testEventId}-negative-sequence`,
        bootId: `${testBootId}-negative-sequence`,
        deviceId: device.id,
        lineId: line.id,
        sequence: -1,
        eventType: 'DETECTION',
        deviceTime: new Date(),
        assignmentStatus: 'UNASSIGNED',
        eventMode: 'PRODUCTION',
        rawPayload: { test: true },
      })
    ).rejects.toThrow(/sensor_events_sequence_non_negative|check constraint/i);

    // Clean up
    await db.delete(schema.sensorEvents).where(eq(schema.sensorEvents.id, evt1.id));
    await db.delete(schema.sensorEvents).where(eq(schema.sensorEvents.id, evtAfterRestart.id));
  });
});
