import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export interface ReceivingChartSource {
  id: string;
  deliveryNoteNumber: string;
  receivingDate: string;
  licensePlateSnapshot: string;
  manifestCount: number;
  actualCount: number;
}

export interface ReceivingChartDatum extends ReceivingChartSource {
  label: string;
  manifest: number;
  actual: number;
}

export function getRecentReceivingChartData(
  items: ReceivingChartSource[] = [],
  limit = 12
): ReceivingChartDatum[] {
  return items.slice(0, limit).map((item) => ({
    ...item,
    label: item.deliveryNoteNumber,
    manifest: item.manifestCount,
    actual: item.actualCount,
  }));
}

export function getDetectionChartData(assigned = 0, unassigned = 0) {
  return [
    { key: "assigned", label: "Assigned", value: assigned, fill: "var(--color-assigned)" },
    { key: "unassigned", label: "Unassigned", value: unassigned, fill: "var(--color-unassigned)" },
  ];
}

interface LineChartSource {
  line: { id: string; name: string; lineCode?: string | null };
  activeSession?: {
    actualCount?: number | null;
    receiving?: { manifestCount?: number | null } | null;
  } | null;
}

export function getActiveLineChartData(items: LineChartSource[] = []) {
  return items
    .filter((item) => Boolean(item.activeSession))
    .map((item) => ({
      id: item.line.id,
      line: item.line.lineCode || item.line.name,
      manifest: item.activeSession?.receiving?.manifestCount || 0,
      actual: item.activeSession?.actualCount || 0,
    }));
}

export interface TrendChartSource {
  date: string;
  manifestCount: number;
  actualCount: number;
  completedReceivingCount: number;
}

export function getTrendChartData(items: TrendChartSource[] = []) {
  return items.map((item) => {
    let formattedLabel = item.date;
    try {
      const parsed = parseISO(item.date);
      formattedLabel = format(parsed, 'dd MMM', { locale: idLocale });
    } catch {
      // fallback
    }

    return {
      date: item.date,
      label: formattedLabel,
      manifest: item.manifestCount,
      actual: item.actualCount,
      completedCount: item.completedReceivingCount,
    };
  });
}
