import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { unauthorizedError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const user = await getAuthSession(req);

  if (!user) {
    return unauthorizedError();
  }

  return NextResponse.json({ user });
}
