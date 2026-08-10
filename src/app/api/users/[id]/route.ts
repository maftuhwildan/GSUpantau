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
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const updateUserSchema = z.object({
  name: z.string().min(1, 'Nama pengguna wajib diisi.').max(100).trim().optional(),
  email: z
    .string()
    .email('Format email tidak valid.')
    .max(255)
    .transform((v) => v.toLowerCase().trim())
    .optional(),
  password: z.string().min(12, 'Password minimal 12 karakter.').optional(),
  role: z.enum(['OPERATOR', 'ADMIN']).optional(),
  assignedLineId: z.string().uuid('ID Line tidak valid.').nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requirePermission(req, 'users:manage');
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, id),
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
        assignedLine: true,
      },
    });

    if (!userRecord) {
      return notFoundError('Pengguna tidak ditemukan.');
    }

    return NextResponse.json({
      user: {
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        status: userRecord.status,
        assignedLineId: userRecord.assignedLineId,
        assignedLine: userRecord.assignedLine
          ? {
              id: userRecord.assignedLine.id,
              lineCode: userRecord.assignedLine.lineCode,
              name: userRecord.assignedLine.name,
            }
          : null,
        roles: userRecord.userRoles.map((ur) => ur.role.code),
        lastLoginAt: userRecord.lastLoginAt,
        createdAt: userRecord.createdAt,
        updatedAt: userRecord.updatedAt,
      },
    });
  } catch (error) {
    console.error('GET /api/users/[id] error:', error);
    return internalError();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: currentUser, errorResponse } = await requirePermission(req, 'users:manage');
  if (errorResponse) return errorResponse;

  try {
    const { id: targetUserId } = await params;
    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(
        'Input tidak valid.',
        parsed.error.flatten().fieldErrors as Record<string, unknown>
      );
    }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    });

    if (!existingUser) {
      return notFoundError('Pengguna tidak ditemukan.');
    }

    const currentRoles = existingUser.userRoles.map((ur) => ur.role.code);
    const isTargetAdmin = currentRoles.includes('ADMIN');

    const { name, email, password, role, assignedLineId, status } = parsed.data;

    // 1. Self-deactivation guard
    if (currentUser!.id === targetUserId && status === 'INACTIVE') {
      return conflictError('Anda tidak dapat menonaktifkan akun Anda sendiri.');
    }

    // 2. Email uniqueness check if email changed
    if (email && email !== existingUser.email) {
      const emailUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
      if (emailUser) {
        return conflictError(`Email '${email}' sudah digunakan oleh pengguna lain.`);
      }
    }

    // 3. Operator Line Requirement (pindahkan evaluasi role/line ke atas transaksi)
    const effectiveRole = role ?? (isTargetAdmin ? 'ADMIN' : 'OPERATOR');
    const effectiveAssignedLineId =
      assignedLineId !== undefined ? assignedLineId : existingUser.assignedLineId;

    if (effectiveRole === 'OPERATOR' && (!effectiveAssignedLineId || effectiveAssignedLineId.trim() === '')) {
      return validationError('Operator harus memiliki Line yang ditugaskan.', {
        assignedLineId: ['Operator harus memiliki Line yang ditugaskan.'],
      });
    }

    // 4. Verify line existence if provided
    if (effectiveAssignedLineId) {
      const lineRecord = await db.query.lines.findFirst({
        where: eq(lines.id, effectiveAssignedLineId),
      });
      if (!lineRecord) {
        return notFoundError('Line yang ditugaskan tidak ditemukan.');
      }
    }

    // Prepare update data
    const updateValues: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateValues.name = name;
    if (email !== undefined) updateValues.email = email;
    if (status !== undefined) updateValues.status = status;
    if (effectiveRole === 'OPERATOR') {
      updateValues.assignedLineId = effectiveAssignedLineId;
    } else {
      updateValues.assignedLineId = assignedLineId !== undefined ? assignedLineId : existingUser.assignedLineId;
    }

    if (password) {
      updateValues.passwordHash = await bcrypt.hash(password, 10);
    }

    const result = await db.transaction(async (tx) => {
      // 5. Last Admin protection guard INSIDE TX
      const isCurrentlyActiveAdmin = isTargetAdmin && existingUser.status === 'ACTIVE';
      const isLosingAdminStatus =
        isCurrentlyActiveAdmin &&
        ((status && status === 'INACTIVE') || (role && role === 'OPERATOR'));

      if (isLosingAdminStatus) {
        const adminRole = await tx.query.roles.findFirst({
          where: eq(roles.code, 'ADMIN'),
        });
        
        if (adminRole) {
          // Lock all active admin users to prevent concurrent deactivations
          const activeAdmins = await tx
            .select()
            .from(users)
            .innerJoin(userRoles, eq(users.id, userRoles.userId))
            .where(and(eq(users.status, 'ACTIVE'), eq(userRoles.roleId, adminRole.id)))
            .for('update');

          if (activeAdmins.length <= 1) {
            throw new Error('LAST_ADMIN_PROTECTION');
          }
        }
      }

      const [updatedUser] = await tx
        .update(users)
        .set(updateValues)
        .where(eq(users.id, targetUserId))
        .returning();

      let newRoleCode = currentRoles[0] ?? 'OPERATOR';

      if (role && role !== currentRoles[0]) {
        await tx.delete(userRoles).where(eq(userRoles.userId, targetUserId));

        const roleRecord = await tx.query.roles.findFirst({
          where: eq(roles.code, role),
        });
        if (!roleRecord) {
          throw new Error(`Role '${role}' tidak ditemukan di sistem.`);
        }

        await tx.insert(userRoles).values({
          userId: targetUserId,
          roleId: roleRecord.id,
        });

        newRoleCode = role;
      }

      const action = password ? 'RESET_PASSWORD' : 'UPDATE_USER';

      const auditLog = await createAuditLog(
        {
          actorId: currentUser!.id,
          actorRole: currentUser!.roles[0] ?? null,
          action,
          entityType: 'user',
          entityId: updatedUser.id,
          beforeData: {
            name: existingUser.name,
            email: existingUser.email,
            status: existingUser.status,
            assignedLineId: existingUser.assignedLineId,
            roles: currentRoles,
          },
          afterData: {
            name: updatedUser.name,
            email: updatedUser.email,
            status: updatedUser.status,
            assignedLineId: updatedUser.assignedLineId,
            roles: [newRoleCode],
            passwordReset: Boolean(password),
          },
          source: 'WEB',
        },
        tx
      );

      return { user: updatedUser, role: newRoleCode, auditLog };
    });

    // Disconnect active WebSocket connections for this user so any changes (status, role, line) take effect immediately.
    wsBroadcaster.disconnectUser(targetUserId);

    wsBroadcaster.broadcast('audit.created', {
      audit_log_id: result.auditLog.id,
      action: result.auditLog.action,
      entity_type: result.auditLog.entityType,
      entity_id: result.auditLog.entityId,
    });

    return NextResponse.json({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        status: result.user.status,
        assignedLineId: result.user.assignedLineId,
        roles: [result.role],
        updatedAt: result.user.createdAt,
      },
    });
  } catch (error) {
    console.error('PATCH /api/users/[id] error:', error);
    if (error instanceof Error && error.message === 'LAST_ADMIN_PROTECTION') {
      return conflictError('Sistem harus memiliki setidaknya satu Admin yang aktif.');
    }
    return internalError();
  }
}
