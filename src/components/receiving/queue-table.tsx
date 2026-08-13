'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, Clock, Edit, FileText, XCircle } from 'lucide-react';
import { EmptyState, LoadingState } from '@/components/ui/states';

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
    return <LoadingState label="Memuat data Surat Jalan" />;
  }

  if (receivings.length === 0) {
    return <EmptyState title="Belum ada Surat Jalan" description="Data yang sesuai filter akan muncul di sini." />;
  }

  const renderStatus = (receiving: ReceivingData) => {
    if (receiving.status === 'DRAFT') return <StatusBadge tone="neutral">Draf</StatusBadge>;
    if (receiving.status === 'WAITING') return <StatusBadge tone="info">Menunggu</StatusBadge>;
    if (receiving.status === 'COUNTING') return <StatusBadge tone="warning" className="motion-safe:animate-pulse">Sedang dihitung</StatusBadge>;
    if (receiving.status === 'COMPLETED') return <StatusBadge tone="success">Selesai</StatusBadge>;
    if (receiving.status === 'CANCELLED') return <StatusBadge tone="danger">Dibatalkan</StatusBadge>;
    return <Badge variant="outline">{receiving.status}</Badge>;
  };

  const renderActions = (receiving: ReceivingData, mobile = false) => (
    <div className={mobile ? 'grid grid-cols-2 gap-2' : 'flex items-center justify-end gap-1.5'}>
      {isAdmin && receiving.status === 'DRAFT' && onPublish && (
        <Button size="sm" onClick={() => onPublish(receiving)} className={mobile ? 'h-11' : 'h-8'}>
          Terbitkan
        </Button>
      )}
      {isAdmin && (receiving.status === 'DRAFT' || receiving.status === 'WAITING') && onEdit && (
        <Button size="sm" variant="outline" onClick={() => onEdit(receiving)} className={mobile ? 'h-11' : 'h-8'}>
          <Edit /> {receiving.status === 'WAITING' ? 'Revisi' : 'Edit'}
        </Button>
      )}
      {isAdmin && (receiving.status === 'DRAFT' || receiving.status === 'WAITING') && onCancel && (
        <Button size="sm" variant="ghost" onClick={() => onCancel(receiving)} className={mobile ? 'h-11 text-destructive' : 'h-8 text-destructive'}>
          <XCircle /> Batal
        </Button>
      )}
      {receiving.status === 'WAITING' && (
        <Button size="sm" onClick={() => onStart ? onStart(receiving) : null} asChild={!onStart} className={mobile ? 'h-11' : 'h-8'}>
          {onStart ? <><Play /> Mulai Penghitungan</> : <Link href={isAdmin ? '/admin/counting' : '/active-session'}><Play /> Mulai Penghitungan</Link>}
        </Button>
      )}
      {receiving.status === 'COUNTING' && (
        <Button size="sm" variant="outline" asChild className={mobile ? 'h-11' : 'h-8'}>
          <Link href={isAdmin ? '/admin/counting' : '/active-session'}><Clock /> Console</Link>
        </Button>
      )}
      {onDetail && (
        <Button size="sm" variant="ghost" onClick={() => onDetail(receiving)} className={mobile ? 'h-11' : 'h-8'}>
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
                  <p className="truncate text-sm font-medium">{receiving.licensePlateSnapshot}</p>
                  <p className="truncate text-xs text-muted-foreground">{receiving.deliveryNoteNumber} • {receiving.driverNameSnapshot}</p>
                </div>
                {renderStatus(receiving)}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                <div><dt className="text-muted-foreground">Supplier</dt><dd className="mt-0.5 truncate font-normal">{receiving.supplierNameSnapshot}</dd></div>
                <div><dt className="text-muted-foreground">Jalur</dt><dd className="mt-0.5 font-normal">{receiving.lineName || '-'}</dd></div>
                <div><dt className="text-muted-foreground">Manifest</dt><dd className="mt-0.5 font-normal tabular-nums">{receiving.manifestCount.toLocaleString('id-ID')} ekor</dd></div>
                <div><dt className="text-muted-foreground">Hasil sensor</dt><dd className="mt-0.5 font-normal tabular-nums">{receiving.actualCount == null ? 'Belum dihitung' : `${receiving.actualCount.toLocaleString('id-ID')} ekor`}</dd></div>
              </dl>
              {renderActions(receiving, true)}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
      <Table>
        <TableHeader className="bg-muted/60">
          <TableRow>
            <TableHead className="w-10 text-center">Pos</TableHead>
            <TableHead>No. Surat Jalan</TableHead>
            <TableHead>Plat & Supir</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Jalur</TableHead>
            <TableHead className="text-right">Manifest</TableHead>
            <TableHead className="text-right">Hasil sensor</TableHead>
            <TableHead className="text-right">Selisih</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {receivings.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-center font-normal text-muted-foreground tabular-nums">
                {r.status === 'WAITING' || r.status === 'COUNTING' ? r.queuePosition : '-'}
              </TableCell>
              <TableCell>
                <div className="font-medium text-foreground">{r.deliveryNoteNumber}</div>
                <div className="text-xs text-muted-foreground">{r.receivingNumber}</div>
              </TableCell>
              <TableCell>
                <div className="font-medium">{r.licensePlateSnapshot}</div>
                <div className="text-xs text-muted-foreground">{r.driverNameSnapshot}</div>
              </TableCell>
              <TableCell className="text-muted-foreground">{r.supplierNameSnapshot}</TableCell>
              <TableCell className="text-muted-foreground">
                {r.lineName ? (
                  <Badge variant="outline">
                    {r.lineName}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground italic">-</span>
                )}
              </TableCell>
              <TableCell className="text-right font-normal tabular-nums">
                {r.manifestCount.toLocaleString('id-ID')} ekor
              </TableCell>
              <TableCell className="text-right font-normal tabular-nums">
                {r.actualCount !== null && r.actualCount !== undefined
                  ? `${r.actualCount.toLocaleString('id-ID')} ekor`
                  : <span className="text-muted-foreground italic">Belum dihitung</span>}
              </TableCell>
              <TableCell className="text-right font-normal tabular-nums">
                {r.differenceCount !== null && r.differenceCount !== undefined ? (
                  <span className={r.differenceCount < 0 ? 'text-destructive' : r.differenceCount > 0 ? 'text-success' : 'text-muted-foreground'}>
                    {r.differenceCount > 0 ? `+${r.differenceCount}` : r.differenceCount} ekor
                    {r.differencePercent !== null && ` (${r.differencePercent}%)`}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {renderStatus(r)}
              </TableCell>
              <TableCell className="text-right">
                {renderActions(r)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </>
  );
}
