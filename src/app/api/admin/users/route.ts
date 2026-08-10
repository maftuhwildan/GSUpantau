import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { db } from '@/db';
import { internalError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requirePermission(req, 'users:manage');
  if (errorResponse) {
    return errorResponse;
  }

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

    return NextResponse.json({
      users: formattedUsers,
      requestedBy: user?.email,
    });
  } catch (err) {
    console.error('Failed to fetch users:', err);
    return internalError();
  }
}
