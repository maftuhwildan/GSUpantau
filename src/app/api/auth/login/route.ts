import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { getPermissionsForRoles } from '@/lib/permissions';
import {
  signSessionToken,
  setAuthCookie,
  SESSION_MAX_AGE,
} from '@/lib/auth';
import { validationError, createErrorResponse, internalError } from '@/lib/errors';

const loginSchema = z.object({
  email: z.string().email({ message: 'Format email tidak valid.' }),
  password: z.string().min(1, { message: 'Kata sandi wajib diisi.' }),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parseResult = loginSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(
        'Email atau kata sandi tidak sesuai standar.',
        parseResult.error.flatten().fieldErrors
      );
    }

    const { email, password } = parseResult.data;

    // Find user by email
    const userList = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);

    if (userList.length === 0) {
      return createErrorResponse('UNAUTHORIZED', 'Email atau kata sandi salah.', 401);
    }

    const user = userList[0];

    if (user.status !== 'ACTIVE') {
      return createErrorResponse('FORBIDDEN', 'Akun Anda tidak aktif.', 403);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return createErrorResponse('UNAUTHORIZED', 'Email atau kata sandi salah.', 401);
    }

    // Fetch user roles
    const userRoleRecords = await db
      .select({
        roleCode: schema.roles.code,
      })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
      .where(eq(schema.userRoles.userId, user.id));

    const roles = userRoleRecords.map((r) => r.roleCode);
    const permissions = getPermissionsForRoles(roles);

    // Update lastLoginAt
    await db
      .update(schema.users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.users.id, user.id));

    // Sign token & set cookie
    const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
    const token = await signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      roles,
      expiresAt,
    });

    // Write audit log
    await db.insert(schema.auditLogs).values({
      actorId: user.id,
      actorRole: roles[0] || 'UNKNOWN',
      action: 'LOGIN',
      entityType: 'USER',
      entityId: user.id,
      afterData: { email: user.email, roles },
      source: 'WEB',
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles,
        permissions,
      },
    });

    setAuthCookie(response, token);

    return response;
  } catch (err) {
    console.error('Login error:', err);
    return internalError();
  }
}
