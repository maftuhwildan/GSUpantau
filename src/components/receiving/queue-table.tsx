'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

  const renderStatus = (receiving: ReceivingData) => {
    if (receiving.status === 'DRAFT') return <StatusBadge tone="neutral">DRAFT</StatusBadge>;
    if (receiving.status === 'WAITING') return <StatusBadge tone="info">WAITING</StatusBadge>;
    if (receiving.status === 'COUNTING') return <StatusBadge tone="warning" className="animate-pulse">COUNTING</StatusBadge>;
    if (receiving.status === 'COMPLETED') return <StatusBadge tone="success">COMPLETED</StatusBadge>;
    if (receiving.status === 'CANCELLED') return <StatusBadge tone="danger">CANCELLED</StatusBadge>;
    return <Badge variant="outline">{receiving.status}</Badge>;
  };

  const renderActions = (receiving: ReceivingData, mobile = false) => (
    <div className={mobile ? 'grid grid-cols-2 gap-2' : 'flex items-center justify-end gap-1.5'}>
      {isAdmin && receiving.status === 'DRAFT' && onPublish && (
        <Button size="sm" onClick={() => onPublish(receiving)} className={mobile ? 'h-11' : 'h-8 text-xs'}>
          Publish
        </Button>
      )}
      {isAdmin && (receiving.status === 'DRAFT' || receiving.status === 'WAITING') && onEdit && (
        <Button size="sm" variant="outline" onClick={() => onEdit(receiving)} className={mobile ? 'h-11' : 'h-8 text-xs'}>
          <Edit /> {receiving.status === 'WAITING' ? 'Revisi' : 'Edit'}
        </Button>
      )}
      {isAdmin && (receiving.status === 'DRAFT' || receiving.status === 'WAITING') && onCancel && (
        <Button size="sm" variant="ghost" onClick={() => onCancel(receiving)} className={mobile ? 'h-11 text-destructive' : 'h-8 text-xs text-destructive'}>
          <XCircle /> Batal
        </Button>
      )}
      {receiving.status === 'WAITING' && (
        <Button size="sm" onClick={() => onStart ? onStart(receiving) : null} asChild={!onStart} className={mobile ? 'h-11' : 'h-8 text-xs'}>
          {onStart ? <><Play /> Mulai Hitung</> : <Link href={isAdmin ? '/admin/counting' : '/active-session'}><Play /> Mulai Hitung</Link>}
        </Button>
      )}
      {receiving.status === 'COUNTING' && (
        <Button size="sm" variant="outline" asChild className={mobile ? 'h-11' : 'h-8 text-xs'}>
          <Link href={isAdmin ? '/admin/counting' : '/active-session'}><Clock /> Console</Link>
        </Button>
      )}
      {onDetail && (
        <Button size="sm" variant="ghost" onClick={() => onDetail(receiving)} className={mobile ? 'h-11' : 'h-8 text-xs'}>
          <FileText /> Detail
        </Button>
      )}
    </div>
  );

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {receivings.map((receiving) => (
          <Card key={receiving.id} className="overflow-hidden">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-heading font-semibold">{receiving.licensePlateSnapshot}</p>
                  <p className="truncate text-xs text-muted-foreground">{receiving.deliveryNoteNumber} • {receiving.driverNameSnapshot}</p>
                </div>
                {renderStatus(receiving)}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                <div><dt className="text-muted-foreground">Supplier</dt><dd className="mt-0.5 truncate font-medium">{receiving.supplierNameSnapshot}</dd></div>
                <div><dt className="text-muted-foreground">Jalur</dt><dd className="mt-0.5 font-medium">{receiving.lineName || '-'}</dd></div>
                <div><dt className="text-muted-foreground">Manifest</dt><dd className="mt-0.5 font-semibold tabular-nums">{receiving.manifestCount.toLocaleString('id-ID')} ekor</dd></div>
                <div><dt className="text-muted-foreground">Actual Sensor</dt><dd className="mt-0.5 font-semibold tabular-nums">{receiving.actualCount == null ? 'Belum dihitung' : `${receiving.actualCount.toLocaleString('id-ID')} ekor`}</dd></div>
              </dl>
              {renderActions(receiving, true)}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border bg-muted/60 font-semibold text-foreground">
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
            <tr key={r.id} className="transition-colors hover:bg-muted/40">
              <td className="p-3 text-center font-bold text-slate-500">
                {r.status === 'WAITING' || r.status === 'COUNTING' ? r.queuePosition : '-'}
              </td>
              <td className="p-3 font-semibold text-foreground">
                <div>{r.deliveryNoteNumber}</div>
                <div className="text-[10px] font-mono text-muted-foreground">{r.receivingNumber}</div>
              </td>
              <td className="p-3">
                <div className="font-bold text-primary">{r.licensePlateSnapshot}</div>
                <div className="text-[11px] text-muted-foreground">{r.driverNameSnapshot}</div>
              </td>
              <td className="p-3 text-muted-foreground">{r.supplierNameSnapshot}</td>
              <td className="p-3 text-muted-foreground">
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
              <td className="p-3 text-right font-bold text-primary">
                {r.actualCount !== null && r.actualCount !== undefined
                  ? `${r.actualCount.toLocaleString('id-ID')} ekor`
                  : <span className="text-muted-foreground font-normal italic">Belum dihitung</span>}
              </td>
              <td className="p-3 text-right font-bold">
                {r.differenceCount !== null && r.differenceCount !== undefined ? (
                  <span className={r.differenceCount < 0 ? 'text-destructive' : r.differenceCount > 0 ? 'text-success' : 'text-muted-foreground'}>
                    {r.differenceCount > 0 ? `+${r.differenceCount}` : r.differenceCount} ekor
                    {r.differencePercent !== null && ` (${r.differencePercent}%)`}
                  </span>
                ) : (
                  <span className="text-muted-foreground font-normal">-</span>
                )}
              </td>
              <td className="p-3 text-center">
                {renderStatus(r)}
              </td>
              <td className="p-3 text-right">
                {renderActions(r)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
