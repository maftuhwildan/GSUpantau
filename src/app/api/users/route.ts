import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { lines, roles, userRoles, users } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import {
  conflictError,
  internalError,
  notFoundError,
  validationError,
} from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
import { wsBroadcaster } from '@/lib/ws';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(1, 'Nama pengguna wajib diisi.').max(100).trim(),
  email: z
    .string()
    .email('Format email tidak valid.')
    .max(255)
    .transform((v) => v.toLowerCase().trim()),
  password: z.string().min(12, 'Password minimal 12 karakter.'),
  role: z.enum(['OPERATOR', 'ADMIN']),
  assignedLineId: z.string().uuid('ID Line tidak valid.').nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export async function GET(req: NextRequest) {
  const { errorResponse } = await requirePermission(req, 'users:manage');
  if (errorResponse) return errorResponse;

  try {
    const userRecords = await db.query.users.findMany({
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
        assignedLine: true,
      },
      orderBy: (usersTable, { desc }) => [desc(usersTable.createdAt)],
    });

    const formattedUsers = userRecords.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      status: u.status,
      assignedLineId: u.assignedLineId,
      assignedLine: u.assignedLine
        ? {
            id: u.assignedLine.id,
            lineCode: u.assignedLine.lineCode,
            name: u.assignedLine.name,
          }
        : null,
      roles: u.userRoles.map((ur) => ur.role.code),
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    return NextResponse.json({ users: formattedUsers });
  } catch (error) {
    console.error('GET /api/users error:', error);
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  const { user: currentUser, errorResponse } = await requirePermission(req, 'users:manage');
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(
        'Input tidak valid.',
        parsed.error.flatten().fieldErrors as Record<string, unknown>
      );
    }

    const { name, email, password, role, assignedLineId, status } = parsed.data;

    // Check email uniqueness
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existingUser) {
      return conflictError(`Email '${email}' sudah digunakan oleh pengguna lain.`);
    }

    // Require assigned line if role is OPERATOR
    if (role === 'OPERATOR' && (!assignedLineId || assignedLineId.trim() === '')) {
      return validationError('Operator harus memiliki Line yang ditugaskan.', {
        assignedLineId: ['Operator harus memiliki Line yang ditugaskan.'],
      });
    }

    // Check if line exists if assignedLineId is provided
    if (assignedLineId) {
      const lineRecord = await db.query.lines.findFirst({
        where: eq(lines.id, assignedLineId),
      });
      if (!lineRecord) {
        return notFoundError('Line yang ditugaskan tidak ditemukan.');
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.transaction(async (tx) => {
      const [createdUser] = await tx
        .insert(users)
        .values({
          name,
          email,
          passwordHash,
          status,
          assignedLineId: role === 'OPERATOR' ? assignedLineId : (assignedLineId || null),
        })
        .returning();

      // Find role record
      const roleRecord = await tx.query.roles.findFirst({
        where: eq(roles.code, role),
      });
      if (!roleRecord) {
        throw new Error(`Role '${role}' tidak ditemukan di sistem.`);
      }

      await tx.insert(userRoles).values({
        userId: createdUser.id,
        roleId: roleRecord.id,
      });

      const auditLog = await createAuditLog(
        {
          actorId: currentUser!.id,
          actorRole: currentUser!.roles[0] ?? null,
          action: 'CREATE_USER',
          entityType: 'user',
          entityId: createdUser.id,
          afterData: {
            id: createdUser.id,
            name: createdUser.name,
            email: createdUser.email,
            status: createdUser.status,
            assignedLineId: createdUser.assignedLineId,
            role,
          },
          source: 'WEB',
        },
        tx
      );

      return { user: createdUser, role, auditLog };
    });

    wsBroadcaster.broadcast('audit.created', {
      audit_log_id: result.auditLog.id,
      action: result.auditLog.action,
      entity_type: result.auditLog.entityType,
      entity_id: result.auditLog.entityId,
    });

    return NextResponse.json(
      {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          status: result.user.status,
          assignedLineId: result.user.assignedLineId,
          roles: [result.role],
          createdAt: result.user.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/users error:', error);
    return internalError();
  }
}
