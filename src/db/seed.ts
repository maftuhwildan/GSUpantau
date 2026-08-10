import { db } from './index';
import * as schema from './schema';
import { runMigrations } from './migrate';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

export async function runSeed() {
  console.log('Ensuring migrations are applied before seeding...');
  await runMigrations();

  console.log('Seeding database...');

  // 1. Clean existing tables in dependency order
  console.log('Cleaning existing data...');
  await db.delete(schema.auditLogs);
  await db.delete(schema.reconciliationReviews);
  await db.delete(schema.sensorEvents);
  await db.delete(schema.receivingSessions);
  await db.delete(schema.manifestRevisions);
  await db.delete(schema.receivings);
  await db.delete(schema.devices);
  await db.delete(schema.lines);
  await db.delete(schema.suppliers);
  await db.delete(schema.drivers);
  await db.delete(schema.trucks);
  await db.delete(schema.userRoles);
  await db.delete(schema.users);
  await db.delete(schema.roles);
  await db.delete(schema.appSettings);

  // 2. Seed Roles
  console.log('Seeding roles...');
  const [operatorRole] = await db.insert(schema.roles).values({
    code: 'OPERATOR',
    name: 'Operator',
    description: 'Petugas operator penimbangan dan pencatatan penerimaan ayam',
  }).returning();

  const [adminRole] = await db.insert(schema.roles).values({
    code: 'ADMIN',
    name: 'Admin',
    description: 'Administrator sistem dengan hak akses penuh',
  }).returning();

  // 3. Seed Users
  console.log('Seeding users...');
  const passwordHash = await bcrypt.hash('password', 10);

  const [operatorUser] = await db.insert(schema.users).values({
    email: 'operator@local.test',
    name: 'Bambang Operator',
    passwordHash,
    status: 'ACTIVE',
  }).returning();

  const [adminUser] = await db.insert(schema.users).values({
    email: 'admin@local.test',
    name: 'Siti Admin',
    passwordHash,
    status: 'ACTIVE',
  }).returning();

  // 4. Assign Roles
  await db.insert(schema.userRoles).values([
    { userId: operatorUser.id, roleId: operatorRole.id },
    { userId: adminUser.id, roleId: adminRole.id },
  ]);

  // 5. Seed Lines
  console.log('Seeding lines...');
  const [line1] = await db.insert(schema.lines).values({
    lineCode: 'LINE-01',
    name: 'Jalur Penerimaan 1',
    status: 'ACTIVE',
  }).returning();

  const [line2] = await db.insert(schema.lines).values({
    lineCode: 'LINE-02',
    name: 'Jalur Penerimaan 2',
    status: 'ACTIVE',
  }).returning();

  // Assign operator to line 1
  await db.update(schema.users)
    .set({ assignedLineId: line1.id })
    .where(eq(schema.users.id, operatorUser.id));

  // 6. Seed Devices (ESP32)
  console.log('Seeding devices...');
  const deviceCredHash1 = await bcrypt.hash('secret-device-key-01', 10);
  const deviceCredHash2 = await bcrypt.hash('secret-device-key-02', 10);

  const [device1] = await db.insert(schema.devices).values({
    deviceCode: 'ESP32-LINE-01',
    lineId: line1.id,
    name: 'Counter Sensor Line 1',
    credentialHash: deviceCredHash1,
    status: 'ONLINE',
    ipAddress: '192.168.1.101',
    firmwareVersion: 'v1.2.0',
    wifiRssi: -62,
    lastHeartbeatAt: new Date(),
    diagnosticPayload: { free_heap: 124500, uptime_seconds: 86400 },
  }).returning();

  const [device2] = await db.insert(schema.devices).values({
    deviceCode: 'ESP32-LINE-02',
    lineId: line2.id,
    name: 'Counter Sensor Line 2',
    credentialHash: deviceCredHash2,
    status: 'ONLINE',
    ipAddress: '192.168.1.102',
    firmwareVersion: 'v1.2.0',
    wifiRssi: -58,
    lastHeartbeatAt: new Date(),
    diagnosticPayload: { free_heap: 128000, uptime_seconds: 93200 },
  }).returning();

  // 7. Seed Master Data (Trucks, Drivers, Suppliers)
  console.log('Seeding master data...');
  const insertedTrucks = await db.insert(schema.trucks).values([
    { licensePlate: 'B 9101 RPA', carrierName: 'PT Angkutan Unggul', status: 'ACTIVE' },
    { licensePlate: 'B 9102 RPA', carrierName: 'PT Angkutan Unggul', status: 'ACTIVE' },
    { licensePlate: 'B 9103 RPA', carrierName: 'CV Trans Ayam', status: 'ACTIVE' },
    { licensePlate: 'B 9104 RPA', carrierName: 'CV Trans Ayam', status: 'ACTIVE' },
    { licensePlate: 'B 9105 RPA', carrierName: 'PT Logistik Unggas', status: 'ACTIVE' },
  ]).returning();

  const insertedDrivers = await db.insert(schema.drivers).values([
    { name: 'Budi Santoso', phone: '081234567801', licenseNumber: 'B1-987654', status: 'ACTIVE' },
    { name: 'Agus Setiawan', phone: '081234567802', licenseNumber: 'B1-987655', status: 'ACTIVE' },
    { name: 'Joko Widodo', phone: '081234567803', licenseNumber: 'B1-987656', status: 'ACTIVE' },
    { name: 'Eko Prasetyo', phone: '081234567804', licenseNumber: 'B1-987657', status: 'ACTIVE' },
    { name: 'Rudi Hermawan', phone: '081234567805', licenseNumber: 'B1-987658', status: 'ACTIVE' },
  ]).returning();

  const insertedSuppliers = await db.insert(schema.suppliers).values([
    { code: 'SUP-01', name: 'Farm Sukses Mandiri', address: 'Bogor, Jawa Barat', phone: '0251-888111', status: 'ACTIVE' },
    { code: 'SUP-02', name: 'PT Poultry Jaya', address: 'Subang, Jawa Barat', phone: '0260-777222', status: 'ACTIVE' },
    { code: 'SUP-03', name: 'CV Ayam Unggul', address: 'Sukabumi, Jawa Barat', phone: '0266-666333', status: 'ACTIVE' },
  ]).returning();

  // 8. Seed Receivings (1 Completed, 1 Counting, 3 Waiting, 1 Draft)
  console.log('Seeding receivings & sessions...');

  const todayStr = new Date().toISOString().split('T')[0];

  // Receiving 1: COMPLETED
  const [recCompleted] = await db.insert(schema.receivings).values({
    receivingNumber: 'REC-20260807-001',
    deliveryNoteNumber: 'SJ-2026-0807-001',
    receivingDate: todayStr,
    documentTruckSequence: 1,
    queuePosition: 1,
    truckId: insertedTrucks[0].id,
    licensePlateSnapshot: insertedTrucks[0].licensePlate,
    driverId: insertedDrivers[0].id,
    driverNameSnapshot: insertedDrivers[0].name,
    supplierId: insertedSuppliers[0].id,
    supplierNameSnapshot: insertedSuppliers[0].name,
    manifestCount: 2500,
    lineId: line1.id,
    status: 'COMPLETED',
    reconciliationStatus: 'MATCHED',
    notes: 'Truk pertama pagi ini, proses lancar.',
    createdBy: adminUser.id,
    publishedAt: new Date(Date.now() - 4 * 3600 * 1000),
  }).returning();

  // Session 1 for Receiving 1: COMPLETED
  const [sessionCompleted] = await db.insert(schema.receivingSessions).values({
    receivingId: recCompleted.id,
    lineId: line1.id,
    status: 'COMPLETED',
    startedAt: new Date(Date.now() - 3.5 * 3600 * 1000),
    startedBy: operatorUser.id,
    finishedAt: new Date(Date.now() - 2.5 * 3600 * 1000),
    finishedBy: operatorUser.id,
  }).returning();

  // Receiving 2: COUNTING (Active)
  const [recCounting] = await db.insert(schema.receivings).values({
    receivingNumber: 'REC-20260807-002',
    deliveryNoteNumber: 'SJ-2026-0807-002',
    receivingDate: todayStr,
    documentTruckSequence: 2,
    queuePosition: 2,
    truckId: insertedTrucks[1].id,
    licensePlateSnapshot: insertedTrucks[1].licensePlate,
    driverId: insertedDrivers[1].id,
    driverNameSnapshot: insertedDrivers[1].name,
    supplierId: insertedSuppliers[1].id,
    supplierNameSnapshot: insertedSuppliers[1].name,
    manifestCount: 3000,
    lineId: line1.id,
    status: 'COUNTING',
    reconciliationStatus: 'PENDING',
    notes: 'Sedang dalam proses penghitungan di Line 1.',
    createdBy: adminUser.id,
    publishedAt: new Date(Date.now() - 2 * 3600 * 1000),
  }).returning();

  // Session 2 for Receiving 2: COUNTING (Active)
  const [sessionActive] = await db.insert(schema.receivingSessions).values({
    receivingId: recCounting.id,
    lineId: line1.id,
    status: 'COUNTING',
    startedAt: new Date(Date.now() - 1 * 3600 * 1000),
    startedBy: operatorUser.id,
  }).returning();

  // Receivings 3-5: WAITING
  await db.insert(schema.receivings).values([
    {
      receivingNumber: 'REC-20260807-003',
      deliveryNoteNumber: 'SJ-2026-0807-003',
      receivingDate: todayStr,
      documentTruckSequence: 3,
      queuePosition: 3,
      truckId: insertedTrucks[2].id,
      licensePlateSnapshot: insertedTrucks[2].licensePlate,
      driverId: insertedDrivers[2].id,
      driverNameSnapshot: insertedDrivers[2].name,
      supplierId: insertedSuppliers[2].id,
      supplierNameSnapshot: insertedSuppliers[2].name,
      manifestCount: 2800,
      lineId: line1.id,
      status: 'WAITING',
      reconciliationStatus: 'PENDING',
      notes: 'Menunggu antrean Line 1',
      createdBy: adminUser.id,
      publishedAt: new Date(Date.now() - 1.5 * 3600 * 1000),
    },
    {
      receivingNumber: 'REC-20260807-004',
      deliveryNoteNumber: 'SJ-2026-0807-004',
      receivingDate: todayStr,
      documentTruckSequence: 1,
      queuePosition: 1,
      truckId: insertedTrucks[3].id,
      licensePlateSnapshot: insertedTrucks[3].licensePlate,
      driverId: insertedDrivers[3].id,
      driverNameSnapshot: insertedDrivers[3].name,
      supplierId: insertedSuppliers[0].id,
      supplierNameSnapshot: insertedSuppliers[0].name,
      manifestCount: 3200,
      lineId: line2.id,
      status: 'WAITING',
      reconciliationStatus: 'PENDING',
      notes: 'Antrean untuk Line 2',
      createdBy: adminUser.id,
      publishedAt: new Date(Date.now() - 1 * 3600 * 1000),
    },
    {
      receivingNumber: 'REC-20260807-005',
      deliveryNoteNumber: 'SJ-2026-0807-005',
      receivingDate: todayStr,
      documentTruckSequence: 4,
      queuePosition: 4,
      truckId: insertedTrucks[4].id,
      licensePlateSnapshot: insertedTrucks[4].licensePlate,
      driverId: insertedDrivers[4].id,
      driverNameSnapshot: insertedDrivers[4].name,
      supplierId: insertedSuppliers[1].id,
      supplierNameSnapshot: insertedSuppliers[1].name,
      manifestCount: 2700,
      lineId: line1.id,
      status: 'WAITING',
      reconciliationStatus: 'PENDING',
      notes: 'Antrean berikutnya',
      createdBy: adminUser.id,
      publishedAt: new Date(Date.now() - 0.5 * 3600 * 1000),
    },
  ]);

  // Receiving 6: DRAFT
  await db.insert(schema.receivings).values({
    receivingNumber: 'REC-20260807-006',
    deliveryNoteNumber: 'SJ-2026-0807-006',
    receivingDate: todayStr,
    documentTruckSequence: 5,
    queuePosition: 5,
    truckId: insertedTrucks[0].id,
    licensePlateSnapshot: insertedTrucks[0].licensePlate,
    driverId: insertedDrivers[0].id,
    driverNameSnapshot: insertedDrivers[0].name,
    supplierId: insertedSuppliers[2].id,
    supplierNameSnapshot: insertedSuppliers[2].name,
    manifestCount: 2600,
    lineId: line1.id,
    status: 'DRAFT',
    reconciliationStatus: 'PENDING',
    notes: 'Draft surat jalan baru diterima dari lapangan',
    createdBy: adminUser.id,
  });

  // 9. Seed Sensor Events (Assigned & Unassigned)
  console.log('Seeding sensor events...');
  const eventsToInsert = [];

  for (let seq = 1; seq <= 15; seq++) {
    eventsToInsert.push({
      eventId: `EVT-LINE01-COMPLETED-${seq}`,
      bootId: 'seed-boot-line-01',
      deviceId: device1.id,
      lineId: line1.id,
      sequence: seq,
      eventType: 'DETECTION',
      deviceTime: new Date(Date.now() - (3 * 3600 - seq * 10) * 1000),
      receivedAt: new Date(Date.now() - (3 * 3600 - seq * 10) * 1000),
      sessionId: sessionCompleted.id,
      assignmentStatus: 'ASSIGNED',
      eventMode: 'PRODUCTION',
      rawPayload: { sensor: 1, val: 1, seq },
    });
  }

  for (let seq = 16; seq <= 30; seq++) {
    eventsToInsert.push({
      eventId: `EVT-LINE01-ACTIVE-${seq}`,
      bootId: 'seed-boot-line-01',
      deviceId: device1.id,
      lineId: line1.id,
      sequence: seq,
      eventType: 'DETECTION',
      deviceTime: new Date(Date.now() - (45 * 60 - (seq - 15) * 10) * 1000),
      receivedAt: new Date(Date.now() - (45 * 60 - (seq - 15) * 10) * 1000),
      sessionId: sessionActive.id,
      assignmentStatus: 'ASSIGNED',
      eventMode: 'PRODUCTION',
      rawPayload: { sensor: 1, val: 1, seq },
    });
  }

  for (let seq = 1; seq <= 5; seq++) {
    eventsToInsert.push({
      eventId: `EVT-LINE02-UNASSIGNED-${seq}`,
      bootId: 'seed-boot-line-02',
      deviceId: device2.id,
      lineId: line2.id,
      sequence: seq,
      eventType: 'DETECTION',
      deviceTime: new Date(Date.now() - (20 * 60 - seq * 5) * 1000),
      receivedAt: new Date(Date.now() - (20 * 60 - seq * 5) * 1000),
      sessionId: null,
      assignmentStatus: 'UNASSIGNED',
      eventMode: 'PRODUCTION',
      rawPayload: { sensor: 2, val: 1, seq },
    });
  }

  eventsToInsert.push({
    eventId: 'EVT-LINE01-HEARTBEAT-1',
    bootId: 'seed-boot-line-01',
    deviceId: device1.id,
    lineId: line1.id,
    sequence: 31,
    eventType: 'HEARTBEAT',
    deviceTime: new Date(),
    receivedAt: new Date(),
    sessionId: sessionActive.id,
    assignmentStatus: 'ASSIGNED',
    eventMode: 'PRODUCTION',
    rawPayload: { rssi: -62, free_heap: 124500 },
  });

  await db.insert(schema.sensorEvents).values(eventsToInsert);

  // 10. Seed Audit Logs & App Settings
  console.log('Seeding audit logs & app settings...');
  await db.insert(schema.auditLogs).values([
    {
      actorId: adminUser.id,
      actorRole: 'ADMIN',
      action: 'RECEIVING_CREATE',
      entityType: 'RECEIVING',
      entityId: recCompleted.id,
      afterData: { receivingNumber: recCompleted.receivingNumber, status: 'DRAFT' },
      source: 'WEB',
      createdAt: new Date(Date.now() - 4 * 3600 * 1000),
    },
    {
      actorId: adminUser.id,
      actorRole: 'ADMIN',
      action: 'RECEIVING_PUBLISH',
      entityType: 'RECEIVING',
      entityId: recCompleted.id,
      afterData: { status: 'WAITING' },
      source: 'WEB',
      createdAt: new Date(Date.now() - 4 * 3600 * 1000),
    },
    {
      actorId: operatorUser.id,
      actorRole: 'OPERATOR',
      action: 'SESSION_START',
      entityType: 'RECEIVING_SESSION',
      entityId: sessionCompleted.id,
      afterData: { receivingId: recCompleted.id, lineId: line1.id, status: 'COUNTING' },
      source: 'WEB',
      createdAt: new Date(Date.now() - 3.5 * 3600 * 1000),
    },
    {
      actorId: operatorUser.id,
      actorRole: 'OPERATOR',
      action: 'SESSION_FINISH',
      entityType: 'RECEIVING_SESSION',
      entityId: sessionCompleted.id,
      afterData: { status: 'COMPLETED' },
      reason: 'Proses pembongkaran truk Selesai dan line berhenti',
      source: 'WEB',
      createdAt: new Date(Date.now() - 2.5 * 3600 * 1000),
    },
  ]);

  await db.insert(schema.appSettings).values([
    { key: 'site_name', value: 'Poultry Receiving Counter System' },
    { key: 'site_timezone', value: 'Asia/Jakarta' },
    { key: 'heartbeat_interval_seconds', value: 10 },
    { key: 'batch_upload_max_events', value: 100 },
    { key: 'heartbeat_offline_threshold_seconds', value: 30 },
    { key: 'heartbeat_degraded_threshold_seconds', value: 15 },
  ]);

  console.log('Database seeding completed successfully!');
}

if (require.main === module || (typeof process !== 'undefined' && process.argv[1]?.includes('seed'))) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}
