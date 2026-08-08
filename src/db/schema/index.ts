import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';

// 1. Roles
export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(), // 'OPERATOR', 'ADMIN'
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'), // 'ACTIVE', 'INACTIVE'
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 3. User Roles
export const userRoles = pgTable('user_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 4. Trucks
export const trucks = pgTable('trucks', {
  id: uuid('id').defaultRandom().primaryKey(),
  licensePlate: varchar('license_plate', { length: 20 }).notNull().unique(),
  carrierName: varchar('carrier_name', { length: 100 }),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 5. Drivers
export const drivers = pgTable('drivers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  licenseNumber: varchar('license_number', { length: 50 }),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 6. Suppliers
export const suppliers = pgTable('suppliers', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 30 }),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 7. Lines
export const lines = pgTable('lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  lineCode: varchar('line_code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'), // 'ACTIVE', 'INACTIVE', 'MAINTENANCE'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 8. Devices
export const devices = pgTable('devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceCode: varchar('device_code', { length: 50 }).notNull().unique(),
  lineId: uuid('line_id').notNull().references(() => lines.id, { onDelete: 'restrict' }),
  name: varchar('name', { length: 100 }).notNull(),
  credentialHash: text('credential_hash').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('UNREGISTERED'), // 'ONLINE', 'DEGRADED', 'OFFLINE', 'MAINTENANCE', 'UNREGISTERED'
  lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
  ipAddress: varchar('ip_address', { length: 45 }),
  firmwareVersion: varchar('firmware_version', { length: 50 }),
  wifiRssi: integer('wifi_rssi'),
  diagnosticPayload: jsonb('diagnostic_payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 9. Receivings
export const receivings = pgTable('receivings', {
  id: uuid('id').defaultRandom().primaryKey(),
  receivingNumber: varchar('receiving_number', { length: 50 }).notNull().unique(),
  deliveryNoteNumber: varchar('delivery_note_number', { length: 100 }).notNull(),
  receivingDate: varchar('receiving_date', { length: 10 }).notNull(), // 'YYYY-MM-DD'
  documentTruckSequence: integer('document_truck_sequence'),
  queuePosition: integer('queue_position').notNull().default(1),
  truckId: uuid('truck_id').references(() => trucks.id),
  licensePlateSnapshot: varchar('license_plate_snapshot', { length: 20 }).notNull(),
  driverId: uuid('driver_id').references(() => drivers.id),
  driverNameSnapshot: varchar('driver_name_snapshot', { length: 100 }).notNull(),
  supplierId: uuid('supplier_id').references(() => suppliers.id),
  supplierNameSnapshot: varchar('supplier_name_snapshot', { length: 100 }).notNull(),
  manifestCount: integer('manifest_count').notNull(),
  lineId: uuid('line_id').references(() => lines.id),
  status: varchar('status', { length: 20 }).notNull().default('DRAFT'), // 'DRAFT', 'WAITING', 'COUNTING', 'COMPLETED', 'CANCELLED'
  reconciliationStatus: varchar('reconciliation_status', { length: 20 }).notNull().default('PENDING'), // 'PENDING', 'MATCHED', 'REVIEW_REQUIRED', 'UNDER_REVIEW', 'RECONCILED', 'REJECTED'
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 10. Manifest Revisions
export const manifestRevisions = pgTable('manifest_revisions', {
  id: uuid('id').defaultRandom().primaryKey(),
  receivingId: uuid('receiving_id').notNull().references(() => receivings.id, { onDelete: 'cascade' }),
  oldManifestCount: integer('old_manifest_count').notNull(),
  newManifestCount: integer('new_manifest_count').notNull(),
  reason: text('reason').notNull(),
  changedBy: uuid('changed_by').notNull().references(() => users.id),
  changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 11. Receiving Sessions
export const receivingSessions = pgTable('receiving_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  receivingId: uuid('receiving_id').notNull().references(() => receivings.id),
  lineId: uuid('line_id').notNull().references(() => lines.id),
  status: varchar('status', { length: 20 }).notNull().default('COUNTING'), // 'COUNTING', 'COMPLETED', 'CANCELLED'
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  startedBy: uuid('started_by').notNull().references(() => users.id),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  finishedBy: uuid('finished_by').references(() => users.id),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelledBy: uuid('cancelled_by').references(() => users.id),
  cancellationReason: text('cancellation_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  oneActiveSessionPerLine: uniqueIndex('one_active_session_per_line').on(table.lineId).where(sql`status = 'COUNTING'`),
  oneActiveSessionPerReceiving: uniqueIndex('one_active_session_per_receiving').on(table.receivingId).where(sql`status = 'COUNTING'`),
}));

// 12. Sensor Events
export const sensorEvents = pgTable('sensor_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: varchar('event_id', { length: 100 }).notNull().unique(),
  bootId: varchar('boot_id', { length: 100 }).notNull(),
  deviceId: uuid('device_id').notNull().references(() => devices.id),
  lineId: uuid('line_id').notNull().references(() => lines.id),
  sequence: integer('sequence').notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(), // 'DETECTION', 'HEARTBEAT', 'DEVICE_RESTART'
  deviceTime: timestamp('device_time', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  sessionId: uuid('session_id').references(() => receivingSessions.id),
  assignmentStatus: varchar('assignment_status', { length: 20 }).notNull().default('UNASSIGNED'), // 'ASSIGNED', 'UNASSIGNED'
  eventMode: varchar('event_mode', { length: 20 }).notNull().default('PRODUCTION'), // 'PRODUCTION', 'TEST', 'MAINTENANCE'
  rawPayload: jsonb('raw_payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  deviceBootSequenceUnique: uniqueIndex('device_boot_sequence_unique').on(
    table.deviceId,
    table.bootId,
    table.sequence
  ),
}));

// 13. Reconciliation Reviews
export const reconciliationReviews = pgTable('reconciliation_reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  receivingId: uuid('receiving_id').notNull().references(() => receivings.id),
  sessionId: uuid('session_id').references(() => receivingSessions.id),
  status: varchar('status', { length: 30 }).notNull().default('PENDING'), // 'PENDING', 'MATCHED', 'REVIEW_REQUIRED', 'UNDER_REVIEW', 'RECONCILED', 'REJECTED'
  differenceCount: integer('difference_count').notNull(),
  differencePercent: doublePrecision('difference_percent'),
  reviewNotes: text('review_notes'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 14. Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id').references(() => users.id),
  actorRole: varchar('actor_role', { length: 50 }),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 100 }).notNull(),
  beforeData: jsonb('before_data'),
  afterData: jsonb('after_data'),
  reason: text('reason'),
  source: varchar('source', { length: 50 }).notNull().default('WEB'),
  requestId: varchar('request_id', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 15. App Settings
export const appSettings = pgTable('app_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// RELATIONS DEFINITIONS FOR DRIZZLE ORM
export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
  receivingsCreated: many(receivings),
  sessionsStarted: many(receivingSessions, { relationName: 'startedBy' }),
  sessionsFinished: many(receivingSessions, { relationName: 'finishedBy' }),
  auditLogs: many(auditLogs),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));

export const linesRelations = relations(lines, ({ many }) => ({
  devices: many(devices),
  receivings: many(receivings),
  sessions: many(receivingSessions),
  sensorEvents: many(sensorEvents),
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  line: one(lines, { fields: [devices.lineId], references: [lines.id] }),
  sensorEvents: many(sensorEvents),
}));

export const receivingsRelations = relations(receivings, ({ one, many }) => ({
  truck: one(trucks, { fields: [receivings.truckId], references: [trucks.id] }),
  driver: one(drivers, { fields: [receivings.driverId], references: [drivers.id] }),
  supplier: one(suppliers, { fields: [receivings.supplierId], references: [suppliers.id] }),
  line: one(lines, { fields: [receivings.lineId], references: [lines.id] }),
  creator: one(users, { fields: [receivings.createdBy], references: [users.id] }),
  sessions: many(receivingSessions),
  manifestRevisions: many(manifestRevisions),
  reconciliationReviews: many(reconciliationReviews),
}));

export const receivingSessionsRelations = relations(receivingSessions, ({ one, many }) => ({
  receiving: one(receivings, { fields: [receivingSessions.receivingId], references: [receivings.id] }),
  line: one(lines, { fields: [receivingSessions.lineId], references: [lines.id] }),
  starter: one(users, { fields: [receivingSessions.startedBy], references: [users.id], relationName: 'startedBy' }),
  finisher: one(users, { fields: [receivingSessions.finishedBy], references: [users.id], relationName: 'finishedBy' }),
  sensorEvents: many(sensorEvents),
}));

export const sensorEventsRelations = relations(sensorEvents, ({ one }) => ({
  device: one(devices, { fields: [sensorEvents.deviceId], references: [devices.id] }),
  line: one(lines, { fields: [sensorEvents.lineId], references: [lines.id] }),
  session: one(receivingSessions, { fields: [sensorEvents.sessionId], references: [receivingSessions.id] }),
}));
