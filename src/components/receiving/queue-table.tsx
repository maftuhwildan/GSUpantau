'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Clock, Edit, FileText, XCircle } from 'lucide-react';

export interface ReceivingData {
  id: string;
  receivingNumber: string;
  deliveryNoteNumber: string;
  receivingDate: string;
  queuePosition: number;
  licensePlateSnapshot: string;
  driverNameSnapshot: string;
  supplierNameSnapshot: string;
  manifestCount: number;
  actualCount?: number | null;
  differenceCount?: number | null;
  differencePercent?: number | null;
  lineId?: string | null;
  lineName?: string | null;
  status: 'DRAFT' | 'WAITING' | 'COUNTING' | 'COMPLETED' | 'CANCELLED' | string;
  reconciliationStatus?: string;
}

interface QueueTableProps {
  receivings: ReceivingData[];
  isAdmin?: boolean;
  onPublish?: (receiving: ReceivingData) => void;
  onEdit?: (receiving: ReceivingData) => void;
  onCancel?: (receiving: ReceivingData) => void;
  onStart?: (receiving: ReceivingData) => void;
  onDetail?: (receiving: ReceivingData) => void;
  loading?: boolean;
}

export function QueueTable({
  receivings,
  isAdmin = false,
  onPublish,
  onEdit,
  onCancel,
  onStart,
  onDetail,
  loading = false,
}: QueueTableProps) {
  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        Memuat data Surat Jalan...
      </div>
    );
  }

  if (receivings.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        Belum ada data Surat Jalan yang tersedia.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-border">
          <tr>
            <th className="p-3 w-10 text-center">Pos</th>
            <th className="p-3">No. Surat Jalan</th>
            <th className="p-3">Plat & Supir</th>
            <th className="p-3">Supplier</th>
            <th className="p-3">Jalur (Line)</th>
            <th className="p-3 text-right">Manifest</th>
            <th className="p-3 text-right">Actual Sensor</th>
            <th className="p-3 text-right">Selisih</th>
            <th className="p-3 text-center">Status</th>
            <th className="p-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {receivings.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
              <td className="p-3 text-center font-bold text-slate-500">
                {r.status === 'WAITING' || r.status === 'COUNTING' ? r.queuePosition : '-'}
              </td>
              <td className="p-3 font-semibold text-foreground">
                <div>{r.deliveryNoteNumber}</div>
                <div className="text-[10px] font-mono text-muted-foreground">{r.receivingNumber}</div>
              </td>
              <td className="p-3">
                <div className="font-bold text-purple-700 dark:text-purple-400">{r.licensePlateSnapshot}</div>
                <div className="text-[11px] text-muted-foreground">{r.driverNameSnapshot}</div>
              </td>
              <td className="p-3 text-slate-600 dark:text-slate-400">{r.supplierNameSnapshot}</td>
              <td className="p-3 text-slate-600 dark:text-slate-400">
                {r.lineName ? (
                  <Badge variant="outline" className="text-[10px]">
                    {r.lineName}
                  </Badge>
                ) : (
                  <span className="text-[11px] text-muted-foreground italic">-</span>
                )}
              </td>
              <td className="p-3 text-right font-bold text-foreground">
                {r.manifestCount.toLocaleString('id-ID')} ekor
              </td>
              <td className="p-3 text-right font-bold text-purple-700 dark:text-purple-400">
                {r.actualCount !== null && r.actualCount !== undefined
                  ? `${r.actualCount.toLocaleString('id-ID')} ekor`
                  : <span className="text-muted-foreground font-normal italic">Belum dihitung</span>}
              </td>
              <td className="p-3 text-right font-bold">
                {r.differenceCount !== null && r.differenceCount !== undefined ? (
                  <span className={r.differenceCount < 0 ? 'text-red-600' : r.differenceCount > 0 ? 'text-emerald-600' : 'text-slate-600'}>
                    {r.differenceCount > 0 ? `+${r.differenceCount}` : r.differenceCount} ekor
                    {r.differencePercent !== null && ` (${r.differencePercent}%)`}
                  </span>
                ) : (
                  <span className="text-muted-foreground font-normal">-</span>
                )}
              </td>
              <td className="p-3 text-center">
                {r.status === 'DRAFT' && <Badge variant="outline">DRAFT</Badge>}
                {r.status === 'WAITING' && (
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                    WAITING
                  </Badge>
                )}
                {r.status === 'COUNTING' && (
                  <Badge variant="warning" className="animate-pulse">
                    COUNTING
                  </Badge>
                )}
                {r.status === 'COMPLETED' && <Badge variant="success">COMPLETED</Badge>}
                {r.status === 'CANCELLED' && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    CANCELLED
                  </Badge>
                )}
              </td>
              <td className="p-3 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  {/* Admin Actions */}
                  {isAdmin && r.status === 'DRAFT' && onPublish && (
                    <Button
                      size="sm"
                      onClick={() => onPublish(r)}
                      className="h-7 text-[11px] bg-purple-600 hover:bg-purple-500 text-white"
                    >
                      Publish
                    </Button>
                  )}
                  {isAdmin && (r.status === 'DRAFT' || r.status === 'WAITING') && onEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(r)}
                      className="h-7 text-[11px] gap-1"
                    >
                      <Edit className="h-3 w-3" />
                      <span>{r.status === 'WAITING' ? 'Revisi' : 'Edit'}</span>
                    </Button>
                  )}
                  {isAdmin && (r.status === 'DRAFT' || r.status === 'WAITING') && onCancel && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onCancel(r)}
                      className="h-7 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <XCircle className="h-3 w-3" />
                    </Button>
                  )}

                  {/* Start / Console Actions */}
                  {r.status === 'WAITING' && (
                    <Button
                      size="sm"
                      onClick={() => onStart ? onStart(r) : null}
                      asChild={!onStart}
                      className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-7 gap-1"
                    >
                      {onStart ? (
                        <>
                          <Play className="h-3 w-3" /> Mulai Hitung
                        </>
                      ) : (
                        <Link href={isAdmin ? '/admin/counting' : '/operator/active-session'}>
                          <Play className="h-3 w-3" /> Mulai Hitung
                        </Link>
                      )}
                    </Button>
                  )}
                  {r.status === 'COUNTING' && (
                    <Button size="sm" variant="outline" asChild className="text-xs h-7 gap-1 border-purple-300">
                      <Link href={isAdmin ? '/admin/counting' : '/operator/active-session'}>
                        <Clock className="h-3 w-3 text-purple-600" /> Console
                      </Link>
                    </Button>
                  )}
                  {onDetail && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDetail(r)}
                      className="h-7 text-[11px] gap-1 text-slate-600"
                    >
                      <FileText className="h-3 w-3" /> Detail
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
