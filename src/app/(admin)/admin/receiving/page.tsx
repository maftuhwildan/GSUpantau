'use client';

import { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, Filter, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { QueueTable, ReceivingData } from '@/components/receiving/queue-table';
import { ReceivingFormDialog } from '@/components/receiving/receiving-form-dialog';
import { ReceivingCancelDialog } from '@/components/receiving/receiving-cancel-dialog';
import { StartCountingDialog } from '@/components/receiving/start-counting-dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useUrlFilters } from '@/lib/use-url-filters';
import { toast } from '@/components/ui/sonner';

const receivingStatusFilters = [
  { value: 'ALL', label: 'Semua' },
  { value: 'DRAFT', label: 'Draf' },
  { value: 'WAITING', label: 'Menunggu' },
  { value: 'COUNTING', label: 'Penghitungan' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
] as const;

type ReceivingStatusFilter = (typeof receivingStatusFilters)[number]['value'];

export default function AdminReceivingPage() {
  const [receivings, setReceivings] = useState<ReceivingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Persistent URL Filters
  const { filters, setFilter } = useUrlFilters({
    status: 'ALL',
    search: '',
  });

  const activeTab = (filters.status as ReceivingStatusFilter) || 'ALL';
  const searchQuery = filters.search || '';

  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [receivingToEdit, setReceivingToEdit] = useState<ReceivingData | null>(null);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [receivingToCancel, setReceivingToCancel] = useState<ReceivingData | null>(null);

  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [receivingToStart, setReceivingToStart] = useState<ReceivingData | null>(null);

  const fetchReceivings = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const params = new URLSearchParams();
      if (activeTab !== 'ALL') {
        params.set('status', activeTab);
      }
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      const res = await fetch(`/api/receivings?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Gagal mengambil data Surat Jalan.');
      }

      setReceivings(data.receivings || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    fetchReceivings();
  }, [fetchReceivings]);

  const handleCreateNew = () => {
    setReceivingToEdit(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (rec: ReceivingData) => {
    setReceivingToEdit(rec);
    setFormDialogOpen(true);
  };

  const handlePublish = async (rec: ReceivingData) => {
    if (!confirm(`Terbitkan Surat Jalan ${rec.deliveryNoteNumber} ke dalam antrean Menunggu?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/receivings/${rec.id}/publish`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Gagal menerbitkan Surat Jalan.');
      }

      toast.success(`Surat Jalan ${rec.deliveryNoteNumber} berhasil diterbitkan ke antrean.`);
      fetchReceivings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      setErrorMsg(msg);
    }
  };

  const handleCancelPrompt = (receiving: ReceivingData) => {
    setReceivingToCancel(receiving);
    setCancelDialogOpen(true);
  };

  const handleStartPrompt = (receiving: ReceivingData) => {
    setReceivingToStart(receiving);
    setStartDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kelola Surat Jalan"
        description="Input data manifest pengiriman truk, terbitkan antrean, atau revisi manifest dengan alasan audit."
        eyebrow="Admin"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchReceivings} className="gap-1 min-h-[44px] sm:min-h-0">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button onClick={handleCreateNew} className="gap-1.5 min-h-[44px] sm:min-h-0">
              <Plus className="h-4 w-4" />
              <span>Input Surat Jalan Baru (Draf)</span>
            </Button>
          </>
        }
      />

      {/* Filter & Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full items-center gap-2 lg:w-80">
            <Input
              placeholder="Cari No. SJ / Plat / Supir / Supplier..."
              value={searchQuery}
              onChange={(e) => setFilter('search', e.target.value)}
              className="w-full text-xs min-h-[44px] sm:min-h-0"
            />
          </div>
          <div className="no-scrollbar w-full overflow-x-auto lg:w-auto">
            <ToggleGroup
              type="single"
              value={activeTab}
              onValueChange={(value) => value && setFilter('status', value)}
              variant="default"
              spacing={1}
              className="min-w-max rounded-2xl bg-muted/60 p-1 ring-1 ring-border/60"
              aria-label="Filter status Surat Jalan"
            >
              {receivingStatusFilters.map((filter) => (
                <ToggleGroupItem
                  key={filter.value}
                  value={filter.value}
                  aria-label={`Tampilkan status ${filter.label}`}
                  className="h-11 rounded-xl px-4 text-xs font-normal text-muted-foreground hover:bg-background/70 hover:text-foreground data-[state=on]:bg-primary data-[state=on]:font-medium data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=on]:hover:bg-primary/90 min-h-[44px]"
                >
                  {filter.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      </Card>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Receivings Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Daftar Surat Jalan Penerimaan</CardTitle>
          <CardDescription className="text-xs">
            Hasil sensor dihitung otomatis secara derivatif dari log sensor dan tidak dapat diedit manual.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <QueueTable
            receivings={receivings}
            isAdmin={true}
            onPublish={handlePublish}
            onEdit={handleEdit}
            onCancel={handleCancelPrompt}
            onStart={handleStartPrompt}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ReceivingFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        receivingToEdit={receivingToEdit}
        onSuccess={() => {
          toast.success(receivingToEdit ? 'Surat Jalan berhasil diperbarui.' : 'Surat Jalan baru (Draf) berhasil dibuat.');
          fetchReceivings();
        }}
      />

      <ReceivingCancelDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        receivingId={receivingToCancel?.id || null}
        deliveryNoteNumber={receivingToCancel?.deliveryNoteNumber || ''}
        onSuccess={() => {
          toast.success('Surat Jalan berhasil dibatalkan.');
          fetchReceivings();
        }}
      />

      <StartCountingDialog
        open={startDialogOpen}
        onOpenChange={setStartDialogOpen}
        receivingId={receivingToStart?.id || null}
        deliveryNoteNumber={receivingToStart?.deliveryNoteNumber || ''}
        isAdmin={true}
      />
    </div>
  );
}
