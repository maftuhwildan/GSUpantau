import { eq } from 'drizzle-orm';
import { lines } from '@/db/schema';

// Drizzle exposes different transaction client types for PostgreSQL and
// PGlite. Both support the same select/for-update API used here.
// eslint-disable-next-line
export async function lockCountingLine(tx: any, lineId: string) {
  const [line] = await tx
    .select()
    .from(lines)
    .where(eq(lines.id, lineId))
    .for('update');

  return line as typeof lines.$inferSelect | undefined;
}
