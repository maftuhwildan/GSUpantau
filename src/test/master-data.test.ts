/**
 * master-data.test.ts
 *
 * Business invariant tests for Batch 16: Master Data CRUD
 * Tests: trucks, drivers, suppliers – Admin-only CRUD, uniqueness, audit, snapshot preservation.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '../db/seed';
import { db } from '../db';
import { users, trucks, drivers, suppliers, receivings, auditLogs } from '../db/schema';
import { signSessionToken, SESSION_COOKIE_NAME } from '../lib/auth';
import { eq } from 'drizzle-orm';

// Route handlers under test
import { GET as getTrucksHandler, POST as createTruckHandler } from '../app/api/trucks/route';
import { GET as getTruckHandler, PATCH as updateTruckHandler } from '../app/api/trucks/[id]/route';
import { GET as getDriversHandler, POST as createDriverHandler } from '../app/api/drivers/route';
import { GET as getDriverHandler, PATCH as updateDriverHandler } from '../app/api/drivers/[id]/route';
import { GET as getSuppliersHandler, POST as createSupplierHandler } from '../app/api/suppliers/route';
import { GET as getSupplierHandler, PATCH as updateSupplierHandler } from '../app/api/suppliers/[id]/route';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(
  url: string,
  method: 'GET' | 'POST' | 'PATCH',
  token: string,
  body?: unknown
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Master Data CRUD (Batch 16)', () => {
  let adminToken: string;
  let operatorToken: string;
  let adminUserId: string;
  // IDs created in tests for later reuse
  let truckId: string;
  let driverId: string;
  let supplierId: string;

  beforeAll(async () => {
    await runSeed();

    const [admin] = await db.select().from(users).where(eq(users.email, 'admin@local.test'));
    const [operator] = await db.select().from(users).where(eq(users.email, 'operator@local.test'));

    adminUserId = admin.id;

    adminToken = await signSessionToken({
      userId: admin.id,
      email: admin.email,
      name: admin.name,
      roles: ['ADMIN'],
      expiresAt: Date.now() + 3600 * 1000,
    });

    operatorToken = await signSessionToken({
      userId: operator.id,
      email: operator.email,
      name: operator.name,
      roles: ['OPERATOR'],
      expiresAt: Date.now() + 3600 * 1000,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TRUCKS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Trucks', () => {
    describe('GET /api/trucks', () => {
      it('admin can list trucks', async () => {
        const req = makeRequest('http://localhost/api/trucks', 'GET', adminToken);
        const res = await getTrucksHandler(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(Array.isArray(json.trucks)).toBe(true);
      });

      it('operator is rejected (403)', async () => {
        const req = makeRequest('http://localhost/api/trucks', 'GET', operatorToken);
        const res = await getTrucksHandler(req);
        expect(res.status).toBe(403);
      });

      it('unauthenticated is rejected (401)', async () => {
        const req = new NextRequest('http://localhost/api/trucks', { method: 'GET' });
        const res = await getTrucksHandler(req);
        expect(res.status).toBe(401);
      });

      it('returns filtered results when status=INACTIVE', async () => {
        const req = makeRequest('http://localhost/api/trucks?status=INACTIVE', 'GET', adminToken);
        const res = await getTrucksHandler(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        // Seed only has ACTIVE trucks, so should be empty
        expect(Array.isArray(json.trucks)).toBe(true);
        expect(json.trucks.every((t: { status: string }) => t.status === 'INACTIVE')).toBe(true);
      });
    });

    describe('POST /api/trucks', () => {
      it('operator is rejected (403)', async () => {
        const req = makeRequest('http://localhost/api/trucks', 'POST', operatorToken, {
          licensePlate: 'B 9999 OPR',
        });
        const res = await createTruckHandler(req);
        expect(res.status).toBe(403);
      });

      it('admin can create a truck', async () => {
        const req = makeRequest('http://localhost/api/trucks', 'POST', adminToken, {
          licensePlate: 'b 1234 new',
          carrierName: 'Armada Test',
        });
        const res = await createTruckHandler(req);
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.truck).toBeDefined();
        expect(json.truck.licensePlate).toBe('B 1234 NEW'); // uppercased
        expect(json.truck.status).toBe('ACTIVE');
        truckId = json.truck.id;
      });

      it('creates an audit log for truck creation', async () => {
        expect(truckId).toBeDefined();
        const logs = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.entityId, truckId));
        expect(logs.length).toBeGreaterThanOrEqual(1);
        expect(logs[0].action).toBe('CREATE_TRUCK');
        expect(logs[0].entityType).toBe('truck');
        expect(logs[0].actorId).toBe(adminUserId);
      });

      it('rejects duplicate license plate (409)', async () => {
        // Try to create same plate again
        const req = makeRequest('http://localhost/api/trucks', 'POST', adminToken, {
          licensePlate: 'B 1234 NEW',
        });
        const res = await createTruckHandler(req);
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.code).toBe('CONFLICT');
      });

      it('rejects missing license plate (400)', async () => {
        const req = makeRequest('http://localhost/api/trucks', 'POST', adminToken, {
          carrierName: 'Missing Plate',
        });
        const res = await createTruckHandler(req);
        expect(res.status).toBe(400);
      });
    });

    describe('PATCH /api/trucks/[id]', () => {
      it('operator is rejected (403)', async () => {
        const req = makeRequest(`http://localhost/api/trucks/${truckId}`, 'PATCH', operatorToken, {
          carrierName: 'Coba Operator',
        });
        const res = await updateTruckHandler(req, { params: Promise.resolve({ id: truckId }) });
        expect(res.status).toBe(403);
      });

      it('admin can update carrier name', async () => {
        const req = makeRequest(`http://localhost/api/trucks/${truckId}`, 'PATCH', adminToken, {
          carrierName: 'Armada Updated',
        });
        const res = await updateTruckHandler(req, { params: Promise.resolve({ id: truckId }) });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.truck.carrierName).toBe('Armada Updated');
      });

      it('creates audit log for truck update', async () => {
        const logs = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.entityId, truckId));
        const updateLogs = logs.filter((l) => l.action === 'UPDATE_TRUCK');
        expect(updateLogs.length).toBeGreaterThanOrEqual(1);
        expect(updateLogs[0].beforeData).toBeDefined();
        expect(updateLogs[0].afterData).toBeDefined();
      });

      it('admin can deactivate a truck (INACTIVE)', async () => {
        const req = makeRequest(`http://localhost/api/trucks/${truckId}`, 'PATCH', adminToken, {
          status: 'INACTIVE',
        });
        const res = await updateTruckHandler(req, { params: Promise.resolve({ id: truckId }) });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.truck.status).toBe('INACTIVE');
      });

      it('rejects duplicate license plate when editing (409)', async () => {
        // Get an existing plate from seed
        const existingTrucks = await db.select().from(trucks).limit(2);
        if (existingTrucks.length < 2) return; // skip if not enough data

        const [first, second] = existingTrucks;
        const req = makeRequest(`http://localhost/api/trucks/${second.id}`, 'PATCH', adminToken, {
          licensePlate: first.licensePlate,
        });
        const res = await updateTruckHandler(req, { params: Promise.resolve({ id: second.id }) });
        expect(res.status).toBe(409);
      });

      it('returns 404 for non-existent truck', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000099';
        const req = makeRequest(`http://localhost/api/trucks/${fakeId}`, 'PATCH', adminToken, {
          carrierName: 'Ghost Truck',
        });
        const res = await updateTruckHandler(req, { params: Promise.resolve({ id: fakeId }) });
        expect(res.status).toBe(404);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DRIVERS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Drivers', () => {
    describe('GET /api/drivers', () => {
      it('admin can list drivers', async () => {
        const req = makeRequest('http://localhost/api/drivers', 'GET', adminToken);
        const res = await getDriversHandler(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(Array.isArray(json.drivers)).toBe(true);
      });

      it('operator is rejected (403)', async () => {
        const req = makeRequest('http://localhost/api/drivers', 'GET', operatorToken);
        const res = await getDriversHandler(req);
        expect(res.status).toBe(403);
      });
    });

    describe('POST /api/drivers', () => {
      it('operator is rejected (403)', async () => {
        const req = makeRequest('http://localhost/api/drivers', 'POST', operatorToken, {
          name: 'Driver By Operator',
        });
        const res = await createDriverHandler(req);
        expect(res.status).toBe(403);
      });

      it('admin can create a driver', async () => {
        const req = makeRequest('http://localhost/api/drivers', 'POST', adminToken, {
          name: 'Supir Baru',
          phone: '081299990001',
          licenseNumber: 'SIM-99001',
        });
        const res = await createDriverHandler(req);
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.driver).toBeDefined();
        expect(json.driver.name).toBe('Supir Baru');
        expect(json.driver.status).toBe('ACTIVE');
        driverId = json.driver.id;
      });

      it('creates audit log for driver creation', async () => {
        expect(driverId).toBeDefined();
        const logs = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.entityId, driverId));
        expect(logs.length).toBeGreaterThanOrEqual(1);
        expect(logs[0].action).toBe('CREATE_DRIVER');
      });

      it('rejects duplicate license number (409)', async () => {
        const req = makeRequest('http://localhost/api/drivers', 'POST', adminToken, {
          name: 'Supir Duplikat',
          licenseNumber: 'SIM-99001', // same as created above
        });
        const res = await createDriverHandler(req);
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.code).toBe('CONFLICT');
      });

      it('allows driver without license number (no uniqueness conflict)', async () => {
        const req = makeRequest('http://localhost/api/drivers', 'POST', adminToken, {
          name: 'Supir Tanpa SIM',
        });
        const res = await createDriverHandler(req);
        expect(res.status).toBe(201);
      });

      it('rejects missing name (400)', async () => {
        const req = makeRequest('http://localhost/api/drivers', 'POST', adminToken, {
          phone: '081299990099',
        });
        const res = await createDriverHandler(req);
        expect(res.status).toBe(400);
      });
    });

    describe('PATCH /api/drivers/[id]', () => {
      it('admin can deactivate a driver', async () => {
        const req = makeRequest(`http://localhost/api/drivers/${driverId}`, 'PATCH', adminToken, {
          status: 'INACTIVE',
        });
        const res = await updateDriverHandler(req, { params: Promise.resolve({ id: driverId }) });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.driver.status).toBe('INACTIVE');
      });

      it('admin can re-activate a driver', async () => {
        const req = makeRequest(`http://localhost/api/drivers/${driverId}`, 'PATCH', adminToken, {
          status: 'ACTIVE',
        });
        const res = await updateDriverHandler(req, { params: Promise.resolve({ id: driverId }) });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.driver.status).toBe('ACTIVE');
      });

      it('operator cannot update driver (403)', async () => {
        const req = makeRequest(`http://localhost/api/drivers/${driverId}`, 'PATCH', operatorToken, {
          name: 'Modified By Operator',
        });
        const res = await updateDriverHandler(req, { params: Promise.resolve({ id: driverId }) });
        expect(res.status).toBe(403);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUPPLIERS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Suppliers', () => {
    describe('GET /api/suppliers', () => {
      it('admin can list suppliers', async () => {
        const req = makeRequest('http://localhost/api/suppliers', 'GET', adminToken);
        const res = await getSuppliersHandler(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(Array.isArray(json.suppliers)).toBe(true);
      });

      it('operator is rejected (403)', async () => {
        const req = makeRequest('http://localhost/api/suppliers', 'GET', operatorToken);
        const res = await getSuppliersHandler(req);
        expect(res.status).toBe(403);
      });
    });

    describe('POST /api/suppliers', () => {
      it('operator is rejected (403)', async () => {
        const req = makeRequest('http://localhost/api/suppliers', 'POST', operatorToken, {
          code: 'SUP-OP',
          name: 'Farm Operator',
        });
        const res = await createSupplierHandler(req);
        expect(res.status).toBe(403);
      });

      it('admin can create a supplier', async () => {
        const req = makeRequest('http://localhost/api/suppliers', 'POST', adminToken, {
          code: 'farm-new-01', // should be uppercased
          name: 'Farm Baru Jaya',
          address: 'Cianjur, Jawa Barat',
          phone: '0263-888999',
        });
        const res = await createSupplierHandler(req);
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.supplier).toBeDefined();
        expect(json.supplier.code).toBe('FARM-NEW-01'); // uppercased
        expect(json.supplier.status).toBe('ACTIVE');
        supplierId = json.supplier.id;
      });

      it('creates audit log for supplier creation', async () => {
        expect(supplierId).toBeDefined();
        const logs = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.entityId, supplierId));
        expect(logs.length).toBeGreaterThanOrEqual(1);
        expect(logs[0].action).toBe('CREATE_SUPPLIER');
      });

      it('rejects duplicate supplier code (409)', async () => {
        const req = makeRequest('http://localhost/api/suppliers', 'POST', adminToken, {
          code: 'FARM-NEW-01', // duplicate
          name: 'Farm Duplikat',
        });
        const res = await createSupplierHandler(req);
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.code).toBe('CONFLICT');
      });

      it('rejects missing code (400)', async () => {
        const req = makeRequest('http://localhost/api/suppliers', 'POST', adminToken, {
          name: 'Farm Tanpa Kode',
        });
        const res = await createSupplierHandler(req);
        expect(res.status).toBe(400);
      });

      it('rejects missing name (400)', async () => {
        const req = makeRequest('http://localhost/api/suppliers', 'POST', adminToken, {
          code: 'SUP-NO-NAME',
        });
        const res = await createSupplierHandler(req);
        expect(res.status).toBe(400);
      });
    });

    describe('PATCH /api/suppliers/[id]', () => {
      it('admin can update supplier name', async () => {
        const req = makeRequest(`http://localhost/api/suppliers/${supplierId}`, 'PATCH', adminToken, {
          name: 'Farm Baru Jaya Updated',
        });
        const res = await updateSupplierHandler(req, { params: Promise.resolve({ id: supplierId }) });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.supplier.name).toBe('Farm Baru Jaya Updated');
      });

      it('creates audit log with before/after for supplier update', async () => {
        const logs = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.entityId, supplierId));
        const updateLogs = logs.filter((l) => l.action === 'UPDATE_SUPPLIER');
        expect(updateLogs.length).toBeGreaterThanOrEqual(1);
        expect(updateLogs[0].beforeData).toBeDefined();
        expect(updateLogs[0].afterData).toBeDefined();
      });

      it('admin can deactivate a supplier', async () => {
        const req = makeRequest(`http://localhost/api/suppliers/${supplierId}`, 'PATCH', adminToken, {
          status: 'INACTIVE',
        });
        const res = await updateSupplierHandler(req, { params: Promise.resolve({ id: supplierId }) });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.supplier.status).toBe('INACTIVE');
      });

      it('rejects duplicate supplier code when editing (409)', async () => {
        // Get an existing supplier to steal its code
        const existingSuppliers = await db.select().from(suppliers).limit(2);
        if (existingSuppliers.length < 2) return;
        const [first, second] = existingSuppliers;

        const req = makeRequest(`http://localhost/api/suppliers/${second.id}`, 'PATCH', adminToken, {
          code: first.code,
        });
        const res = await updateSupplierHandler(req, { params: Promise.resolve({ id: second.id }) });
        expect(res.status).toBe(409);
      });

      it('operator cannot update supplier (403)', async () => {
        const req = makeRequest(`http://localhost/api/suppliers/${supplierId}`, 'PATCH', operatorToken, {
          name: 'Modified By Operator',
        });
        const res = await updateSupplierHandler(req, { params: Promise.resolve({ id: supplierId }) });
        expect(res.status).toBe(403);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SNAPSHOT PRESERVATION INVARIANT
  // ─────────────────────────────────────────────────────────────────────────

  describe('Snapshot preservation', () => {
    it('receiving snapshots remain unchanged after master data update', async () => {
      // Get existing completed receiving (seeded in beforeAll)
      const [receiving] = await db
        .select()
        .from(receivings)
        .where(eq(receivings.status, 'COMPLETED'))
        .limit(1);

      expect(receiving).toBeDefined();
      const originalPlateSnapshot = receiving.licensePlateSnapshot;
      const originalDriverSnapshot = receiving.driverNameSnapshot;
      const originalSupplierSnapshot = receiving.supplierNameSnapshot;

      // Modify the truck's carrier name (not the plate, but to show master data changed)
      if (receiving.truckId) {
        const req = makeRequest(`http://localhost/api/trucks/${receiving.truckId}`, 'PATCH', adminToken, {
          carrierName: 'CHANGED CARRIER',
        });
        await updateTruckHandler(req, { params: Promise.resolve({ id: receiving.truckId }) });
      }

      // Modify the driver's name
      if (receiving.driverId) {
        const req = makeRequest(`http://localhost/api/drivers/${receiving.driverId}`, 'PATCH', adminToken, {
          name: 'CHANGED DRIVER NAME',
        });
        await updateDriverHandler(req, { params: Promise.resolve({ id: receiving.driverId }) });
      }

      // Verify receiving snapshot is unchanged
      const [afterUpdate] = await db
        .select()
        .from(receivings)
        .where(eq(receivings.id, receiving.id));

      expect(afterUpdate.licensePlateSnapshot).toBe(originalPlateSnapshot);
      expect(afterUpdate.driverNameSnapshot).toBe(originalDriverSnapshot);
      expect(afterUpdate.supplierNameSnapshot).toBe(originalSupplierSnapshot);
    });

    it('deactivating a truck does not remove its reference from completed receiving', async () => {
      const [receiving] = await db
        .select()
        .from(receivings)
        .where(eq(receivings.status, 'COMPLETED'))
        .limit(1);

      if (!receiving.truckId) return;

      // Deactivate truck
      const req = makeRequest(`http://localhost/api/trucks/${receiving.truckId}`, 'PATCH', adminToken, {
        status: 'INACTIVE',
      });
      await updateTruckHandler(req, { params: Promise.resolve({ id: receiving.truckId }) });

      // Receiving still references the truck
      const [afterUpdate] = await db
        .select()
        .from(receivings)
        .where(eq(receivings.id, receiving.id));

      // truck_id FK still intact
      expect(afterUpdate.truckId).toBe(receiving.truckId);
      // snapshot still correct
      expect(afterUpdate.licensePlateSnapshot).toBe(receiving.licensePlateSnapshot);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEARCH / FILTER
  // ─────────────────────────────────────────────────────────────────────────

  describe('Search and filter', () => {
    it('trucks search returns filtered results', async () => {
      const req = makeRequest('http://localhost/api/trucks?search=B+9101', 'GET', adminToken);
      const res = await getTrucksHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.trucks)).toBe(true);
      // Should only match the plate that starts with B 9101
      const allMatch = json.trucks.every(
        (t: { licensePlate: string }) =>
          t.licensePlate.toLowerCase().includes('9101') ||
          (t as unknown as { carrierName: string | null }).carrierName?.toLowerCase().includes('9101')
      );
      expect(allMatch).toBe(true);
    });

    it('suppliers search returns filtered results', async () => {
      const req = makeRequest('http://localhost/api/suppliers?search=SUP-01', 'GET', adminToken);
      const res = await getSuppliersHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.suppliers)).toBe(true);
    });

    it('GET /api/trucks/:id returns individual truck', async () => {
      // Fetch the first seeded truck
      const [firstTruck] = await db.select().from(trucks).limit(1);
      const req = makeRequest(`http://localhost/api/trucks/${firstTruck.id}`, 'GET', adminToken);
      const res = await getTruckHandler(req, { params: Promise.resolve({ id: firstTruck.id }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.truck.id).toBe(firstTruck.id);
    });

    it('GET /api/drivers/:id returns individual driver', async () => {
      const [firstDriver] = await db.select().from(drivers).limit(1);
      const req = makeRequest(`http://localhost/api/drivers/${firstDriver.id}`, 'GET', adminToken);
      const res = await getDriverHandler(req, { params: Promise.resolve({ id: firstDriver.id }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.driver.id).toBe(firstDriver.id);
    });

    it('GET /api/suppliers/:id returns individual supplier', async () => {
      const [firstSupplier] = await db.select().from(suppliers).limit(1);
      const req = makeRequest(`http://localhost/api/suppliers/${firstSupplier.id}`, 'GET', adminToken);
      const res = await getSupplierHandler(req, { params: Promise.resolve({ id: firstSupplier.id }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.supplier.id).toBe(firstSupplier.id);
    });
  });
});
