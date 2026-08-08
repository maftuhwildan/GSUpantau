import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { internalError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireRole(req, 'ADMIN');
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const userList = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        status: schema.users.status,
        lastLoginAt: schema.users.lastLoginAt,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users);

    return NextResponse.json({
      users: userList,
      requestedBy: user?.email,
    });
  } catch (err) {
    console.error('Failed to fetch users:', err);
    return internalError();
  }
}
