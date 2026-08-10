import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { receivings, receivingSessions, sensorEvents } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { internalError, validationError } from '@/lib/errors';
import { getDateRangeFromStrings } from '@/lib/time';
import { eq, and, sql, desc, gte, lt, lte } from 'drizzle-orm';

function formatCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  const safeStr = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safeStr.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const { errorResponse } = await requirePermission(req, 'reports:view');
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const lineId = searchParams.get('line_id');
    const format = searchParams.get('format') || searchParams.get('export');

    if (dateFrom && dateTo && dateFrom > dateTo) {
      return validationError('date_from tidak boleh lebih besar dari date_to.');
    }

    let start: Date | null = null;
    let endExclusive: Date | null = null;
    try {
      const range = getDateRangeFromStrings(dateFrom, dateTo);
      start = range.start;
      endExclusive = range.endExclusive;
    } catch (err: any) {
      return validationError(err.message || 'Format tanggal tidak valid.');
    }

    const receivingConditions = [eq(receivings.status, 'COMPLETED')];
    if (dateFrom) receivingConditions.push(gte(receivings.receivingDate, dateFrom));
    if (dateTo) receivingConditions.push(lte(receivings.receivingDate, dateTo));
    if (lineId) receivingConditions.push(eq(receivings.lineId, lineId));

    const completedReceivings = await db.query.receivings.findMany({
      where: and(...receivingConditions),
      with: { line: true, truck: true, supplier: true },
      orderBy: [desc(receivings.receivingDate), desc(receivings.createdAt)],
    });

    let totalManifest = 0;
    let totalActual = 0;

    const formattedList = await Promise.all(
      completedReceivings.map(async (rec) => {
        totalManifest += rec.manifestCount;
        let actualCount = 0;

        // Derive actual ONLY from COMPLETED session for COMPLETED receiving
        const session = await db.query.receivingSessions.findFirst({
          where: and(
            eq(receivingSessions.receivingId, rec.id),
            eq(receivingSessions.status, 'COMPLETED')
          ),
        });

        if (session) {
          const actualRes = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(sensorEvents)
            .where(
              and(
                eq(sensorEvents.sessionId, session.id),
                eq(sensorEvents.eventType, 'DETECTION'),
                eq(sensorEvents.eventMode, 'PRODUCTION'),
                eq(sensorEvents.assignmentStatus, 'ASSIGNED')
              )
            );
          actualCount = actualRes[0]?.count || 0;
          totalActual += actualCount;
        }

        const differenceCount = actualCount - rec.manifestCount;
        const differencePercent =
          rec.manifestCount > 0
            ? Number(((differenceCount / rec.manifestCount) * 100).toFixed(2))
            : 0;

        return {
          ...rec,
          actualCount,
          differenceCount,
          differencePercent,
        };
      })
    );

    const totalDifference = totalActual - totalManifest;
    const totalDifferencePercent =
      totalManifest > 0 ? Number(((totalDifference / totalManifest) * 100).toFixed(2)) : 0;

    // Assigned vs Unassigned Detections using authoritative receivedAt server timestamp & SITE_TIMEZONE
    const detectionsConditions = [
      eq(sensorEvents.eventType, 'DETECTION'),
      eq(sensorEvents.eventMode, 'PRODUCTION'),
    ];

    if (start) detectionsConditions.push(gte(sensorEvents.receivedAt, start));
    if (endExclusive) detectionsConditions.push(lt(sensorEvents.receivedAt, endExclusive));
    if (lineId) detectionsConditions.push(eq(sensorEvents.lineId, lineId));

    const detectionsStats = await db
      .select({
        status: sensorEvents.assignmentStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(sensorEvents)
      .where(and(...detectionsConditions))
      .groupBy(sensorEvents.assignmentStatus);

    let assignedDetections = 0;
    let unassignedDetections = 0;
    detectionsStats.forEach((stat) => {
      if (stat.status === 'ASSIGNED') assignedDetections += stat.count;
      if (stat.status === 'UNASSIGNED') unassignedDetections += stat.count;
    });

    if (format === 'csv') {
      const csvRows: string[] = [];
      // Header
      csvRows.push(
        [
          'Tanggal Penerimaan',
          'No Surat Jalan',
          'Plat Nomor',
          'Supplier',
          'Supir',
          'Line',
          'Manifest (Ekor)',
          'Actual (Ekor)',
          'Selisih (Ekor)',
          'Persentase Selisih (%)',
        ].join(',')
      );

      // Data Rows
      formattedList.forEach((item) => {
        const lineName = item.line?.name || item.line?.lineCode || '-';
        const row = [
          formatCsvCell(item.receivingDate),
          formatCsvCell(item.deliveryNoteNumber || ''),
          formatCsvCell(item.licensePlateSnapshot || ''),
          formatCsvCell(item.supplierNameSnapshot || ''),
          formatCsvCell(item.driverNameSnapshot || ''),
          formatCsvCell(lineName),
          item.manifestCount,
          item.actualCount,
          item.differenceCount,
          item.differencePercent,
        ];
        csvRows.push(row.join(','));
      });

      // Summary Block
      csvRows.push('');
      csvRows.push('--- RINGKASAN LAPORAN ---');
      csvRows.push(`Total Manifest,${totalManifest}`);
      csvRows.push(`Total Actual,${totalActual}`);
      csvRows.push(`Total Selisih,${totalDifference}`);
      csvRows.push(`Total Persentase Selisih (%),${totalDifferencePercent}%`);
      csvRows.push(`Assigned Detections,${assignedDetections}`);
      csvRows.push(`Unassigned Detections,${unassignedDetections}`);

      const csvString = '\uFEFF' + csvRows.join('\n');
      return new NextResponse(csvString, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="laporan-penerimaan-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      summary: {
        totalManifest,
        totalActual,
        totalDifference,
        totalDifferencePercent,
        assignedDetections,
        unassignedDetections,
      },
      list: formattedList,
    });
  } catch (error) {
    console.error('Reports API error:', error);
    return internalError();
  }
}
