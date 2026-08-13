import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getReports } from '@/app/api/reports/route';
import { GET as getAuditLogs } from '@/app/api/audit-logs/route';
import { runSeed } from '../db/seed';
import { db } from '@/db';
import {
  users,
  roles,
  userRoles,
  lines,
  devices,
  receivings,
  receivingSessions,
  sensorEvents,
  auditLogs,
} from '@/db/schema';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

describe('Batch 19: Reports and Audit Trail Invariants & Tests', () => {
  let adminUser: typeof users.$inferSelect;
  let adminCookie: string;
  let testLine1: typeof lines.$inferSelect;
  let testLine2: typeof lines.$inferSelect;
  let testDevice1: typeof devices.$inferSelect;

  beforeAll(async () => {
    await runSeed();
  });

  beforeEach(async () => {
    // 1. Setup Admin user & roles
    const [createdAdmin] = await db
      .insert(users)
      .values({
        name: 'Admin Test B19',
        email: `admin.b19.${crypto.randomUUID()}@local.test`,
        passwordHash: 'hashedpassword',
        status: 'ACTIVE',
      })
      .returning();

    adminUser = createdAdmin;

    let adminRole = await db.query.roles.findFirst({
      where: eq(roles.code, 'ADMIN'),
    });

    if (!adminRole) {
      [adminRole] = await db
        .insert(roles)
        .values({ code: 'ADMIN', name: 'Administrator' })
        .returning();
    }

    await db.insert(userRoles).values({
      userId: adminUser.id,
      roleId: adminRole.id,
    });

    const token = await signSessionToken({
      userId: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      roles: ['ADMIN'],
      expiresAt: Date.now() + 3600 * 1000,
    });

    adminCookie = `${SESSION_COOKIE_NAME}=${token}`;

    // 2. Setup test lines
    [testLine1] = await db
      .insert(lines)
      .values({
        lineCode: `L19-1-${crypto.randomUUID().substring(0, 6)}`,
        name: 'Jalur Test B19 - 1',
        status: 'ACTIVE',
      })
      .returning();

    [testLine2] = await db
      .insert(lines)
      .values({
        lineCode: `L19-2-${crypto.randomUUID().substring(0, 6)}`,
        name: 'Jalur Test B19 - 2',
        status: 'ACTIVE',
      })
      .returning();

    [testDevice1] = await db
      .insert(devices)
      .values({
        deviceCode: `DEV-B19-${crypto.randomUUID().substring(0, 6)}`,
        lineId: testLine1.id,
        name: 'ESP32 Test Line 1',
        credentialHash: 'hash_secret',
        status: 'ONLINE',
      })
      .returning();
  });

  it('reports API filters completed receivings and sensor stats by line_id, date, and exports identical CSV data', async () => {
    // Insert a completed receiving on line 1
    const [rec1] = await db
      .insert(receivings)
      .values({
        receivingNumber: `RCV-B19-1-${crypto.randomUUID().substring(0, 4)}`,
        deliveryNoteNumber: 'SJ-B19-001',
        receivingDate: '2026-08-10',
        licensePlateSnapshot: 'B 1111 B19',
        driverNameSnapshot: 'Supir Test 1',
        supplierNameSnapshot: 'Supplier Test 1',
        manifestCount: 1000,
        lineId: testLine1.id,
        status: 'COMPLETED',
        reconciliationStatus: 'MATCHED',
        createdBy: adminUser.id,
      })
      .returning();

    const [sess1] = await db
      .insert(receivingSessions)
      .values({
        receivingId: rec1.id,
        lineId: testLine1.id,
        status: 'COMPLETED',
        startedBy: adminUser.id,
        finishedBy: adminUser.id,
        startedAt: new Date('2026-08-10T08:00:00Z'),
        finishedAt: new Date('2026-08-10T09:00:00Z'),
      })
      .returning();

    // Add assigned detection event to sess1 using valid device UUID
    await db.insert(sensorEvents).values({
      eventId: `EV-B19-1-${crypto.randomUUID()}`,
      bootId: crypto.randomUUID(),
      deviceId: testDevice1.id,
      lineId: testLine1.id,
      sequence: 1,
      eventType: 'DETECTION',
      eventMode: 'PRODUCTION',
      assignmentStatus: 'ASSIGNED',
      sessionId: sess1.id,
      deviceTime: new Date('2026-08-10T08:30:00Z'),
      receivedAt: new Date('2026-08-10T08:30:00Z'),
      rawPayload: {},
    });

    // Insert a completed receiving on line 2
    const [rec2] = await db
      .insert(receivings)
      .values({
        receivingNumber: `RCV-B19-2-${crypto.randomUUID().substring(0, 4)}`,
        deliveryNoteNumber: 'SJ-B19-002',
        receivingDate: '2026-08-10',
        licensePlateSnapshot: 'B 2222 B19',
        driverNameSnapshot: 'Supir Test 2',
        supplierNameSnapshot: 'Supplier Test 2',
        manifestCount: 500,
        lineId: testLine2.id,
        status: 'COMPLETED',
        reconciliationStatus: 'MATCHED',
        createdBy: adminUser.id,
      })
      .returning();

    // 1. Query JSON report filtered by line 1
    const reqJson = new NextRequest(
      `http://localhost:3000/api/reports?line_id=${testLine1.id}&date_from=2026-08-10&date_to=2026-08-10`,
      { headers: { cookie: adminCookie } }
    );
    const resJson = await getReports(reqJson);
    expect(resJson.status).toBe(200);

    const jsonBody = await resJson.json();
    expect(jsonBody.summary.totalManifest).toBe(1000);
    expect(jsonBody.list).toHaveLength(1);
    expect(jsonBody.list[0].id).toBe(rec1.id);
    expect(jsonBody.list[0].actualCount).toBe(1);

    // 2. Query CSV report filtered by line 1
    const reqCsv = new NextRequest(
      `http://localhost:3000/api/reports?line_id=${testLine1.id}&date_from=2026-08-10&date_to=2026-08-10&format=csv`,
      { headers: { cookie: adminCookie } }
    );
    const resCsv = await getReports(reqCsv);
    expect(resCsv.status).toBe(200);
    expect(resCsv.headers.get('Content-Type')).toContain('text/csv');

    const csvText = await resCsv.text();
    expect(csvText).toContain('SJ-B19-001');
    expect(csvText).not.toContain('SJ-B19-002');
    expect(csvText).toContain('Total Manifest,1000');
    expect(csvText).toContain('Total Actual,1');
  });

  it('audit logs API filters by actor_id, action, entity_type and redacts sensitive credential fields', async () => {
    // Insert mock audit log with sensitive fields
    const [audit1] = await db
      .insert(auditLogs)
      .values({
        actorId: adminUser.id,
        actorRole: 'ADMIN',
        action: 'CREATE_USER',
        entityType: 'user',
        entityId: crypto.randomUUID(),
        beforeData: null,
        afterData: {
          name: 'Super Secret User',
          passwordHash: '$2a$10$abcdef1234567890',
          credentialHash: 'secret_hash_xyz',
          secret: 'my_api_secret',
        },
        reason: 'Testing Batch 19 audit filter',
        source: 'WEB',
      })
      .returning();

    // Query Audit Logs filtered by actor_id and action
    const reqAudit = new NextRequest(
      `http://localhost:3000/api/audit-logs?actor_id=${adminUser.id}&action=CREATE_USER&entity_type=user`,
      { headers: { cookie: adminCookie } }
    );

    const resAudit = await getAuditLogs(reqAudit);
    expect(resAudit.status).toBe(200);

    const body = await resAudit.json();
    expect(body.logs).toBeDefined();
    expect(body.logs.length).toBeGreaterThanOrEqual(1);
    expect(body.filters.actions).toContain('CREATE_USER');
    expect(body.filters.entityTypes).toContain('user');

    const targetLog = body.logs.find((l: any) => l.id === audit1.id);
    expect(targetLog).toBeDefined();
    expect(targetLog.action).toBe('CREATE_USER');
    expect(targetLog.afterData).toBeDefined();

    // Verification of Redaction Invariant
    expect(targetLog.afterData.passwordHash).toBe('[REDACTED]');
    expect(targetLog.afterData.credentialHash).toBe('[REDACTED]');
    expect(targetLog.afterData.secret).toBe('[REDACTED]');
    expect(targetLog.afterData.name).toBe('Super Secret User');
  });

  it('audit logs API can filter system activity and canonical entity aliases', async () => {
    const [systemAudit] = await db
      .insert(auditLogs)
      .values({
        actorId: null,
        actorRole: null,
        action: 'UPDATE_SETTINGS',
        entityType: 'app_settings',
        entityId: crypto.randomUUID(),
        source: 'SYSTEM',
      })
      .returning();

    const reqAudit = new NextRequest(
      'http://localhost:3000/api/audit-logs?actor_id=SYSTEM&entity_type=settings',
      { headers: { cookie: adminCookie } }
    );

    const resAudit = await getAuditLogs(reqAudit);
    expect(resAudit.status).toBe(200);

    const body = await resAudit.json();
    expect(body.logs.some((log: any) => log.id === systemAudit.id)).toBe(true);
    expect(body.logs.every((log: any) => log.actor === null || log.actor.id === null)).toBe(true);
    expect(body.filters.entityTypes).toContain('settings');
    expect(body.filters.entityTypes).not.toContain('app_settings');
  });

  it('validates date_from <= date_to and invalid date format returning HTTP 400 for reports and audit logs', async () => {
    // 1. date_from > date_to on reports
    const reqInvalidRangeReports = new NextRequest(
      'http://localhost:3000/api/reports?date_from=2026-12-31&date_to=2026-01-01',
      { headers: { cookie: adminCookie } }
    );
    const resInvalidRangeReports = await getReports(reqInvalidRangeReports);
    expect(resInvalidRangeReports.status).toBe(400);

    // 2. invalid date string on reports
    const reqInvalidDateReports = new NextRequest(
      'http://localhost:3000/api/reports?date_from=2026-13-45',
      { headers: { cookie: adminCookie } }
    );
    const resInvalidDateReports = await getReports(reqInvalidDateReports);
    expect(resInvalidDateReports.status).toBe(400);

    // 3. date_from > date_to on audit logs
    const reqInvalidRangeAudit = new NextRequest(
      'http://localhost:3000/api/audit-logs?date_from=2026-12-31&date_to=2026-01-01',
      { headers: { cookie: adminCookie } }
    );
    const resInvalidRangeAudit = await getAuditLogs(reqInvalidRangeAudit);
    expect(resInvalidRangeAudit.status).toBe(400);

    // 4. invalid date string on audit logs
    const reqInvalidDateAudit = new NextRequest(
      'http://localhost:3000/api/audit-logs?date_from=invalid-date',
      { headers: { cookie: adminCookie } }
    );
    const resInvalidDateAudit = await getAuditLogs(reqInvalidDateAudit);
    expect(resInvalidDateAudit.status).toBe(400);
  });

  it('escapes CSV formula injection characters and includes UTF-8 BOM', async () => {
    await db.insert(receivings).values({
      receivingNumber: `RCV-INJ-${crypto.randomUUID().substring(0, 4)}`,
      deliveryNoteNumber: '=SUM(A1:A10)',
      receivingDate: '2026-08-10',
      licensePlateSnapshot: '+628123456',
      driverNameSnapshot: '@MaliciousDriver',
      supplierNameSnapshot: 'Normal Supplier',
      manifestCount: 100,
      lineId: testLine1.id,
      status: 'COMPLETED',
      reconciliationStatus: 'MATCHED',
      createdBy: adminUser.id,
    });

    const reqCsv = new NextRequest(
      `http://localhost:3000/api/reports?line_id=${testLine1.id}&date_from=2026-08-10&date_to=2026-08-10&format=csv`,
      { headers: { cookie: adminCookie } }
    );
    const resCsv = await getReports(reqCsv);
    expect(resCsv.status).toBe(200);

    const csvBuffer = Buffer.from(await resCsv.arrayBuffer());
    // Check UTF-8 BOM (0xEF, 0xBB, 0xBF)
    expect(csvBuffer[0]).toBe(0xef);
    expect(csvBuffer[1]).toBe(0xbb);
    expect(csvBuffer[2]).toBe(0xbf);

    const csvText = csvBuffer.toString('utf-8');
    // Check formula injection escaping
    expect(csvText).toContain('"\'=SUM(A1:A10)"');
    expect(csvText).toContain('"\'=SUM(A1:A10)"');
    expect(csvText).toContain('"\'@MaliciousDriver"');
  });

  it('correctly filters audit logs created during the site-timezone day of date_to', async () => {
    // Insert audit log created at 14:00 UTC on 2026-08-10
    const [auditToday] = await db
      .insert(auditLogs)
      .values({
        actorId: adminUser.id,
        actorRole: 'ADMIN',
        action: 'UPDATE_LINE',
        entityType: 'line',
        entityId: testLine1.id,
        createdAt: new Date('2026-08-10T14:00:00Z'),
        reason: 'Mid-day update test',
        source: 'WEB',
      })
      .returning();

    const reqAudit = new NextRequest(
      'http://localhost:3000/api/audit-logs?date_from=2026-08-10&date_to=2026-08-10&action=UPDATE_LINE',
      { headers: { cookie: adminCookie } }
    );
    const resAudit = await getAuditLogs(reqAudit);
    expect(resAudit.status).toBe(200);

    const body = await resAudit.json();
    const foundLog = body.logs.find((l: any) => l.id === auditToday.id);
    expect(foundLog).toBeDefined();
  });
});
