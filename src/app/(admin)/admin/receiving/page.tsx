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

export default function AdminReceivingPage() {
  const [receivings, setReceivings] = useState<ReceivingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

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
    if (!confirm(`Terbitkan Surat Jalan ${rec.deliveryNoteNumber} ke dalam antrean WAITING?`)) {
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

      fetchReceivings();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Terjadi kesalahan.');
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

  const countsByStatus = {
    ALL: receivings.length,
    DRAFT: receivings.filter((r) => r.status === 'DRAFT').length,
    WAITING: receivings.filter((r) => r.status === 'WAITING').length,
    COUNTING: receivings.filter((r) => r.status === 'COUNTING').length,
    COMPLETED: receivings.filter((r) => r.status === 'COMPLETED').length,
    CANCELLED: receivings.filter((r) => r.status === 'CANCELLED').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">Kelola Surat Jalan (Receiving Management)</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Input data manifest pengiriman truck, terbitkan antrean (Publish), atau revisi manifest dengan alasan audit.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchReceivings} className="text-xs gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button onClick={handleCreateNew} className="bg-purple-600 hover:bg-purple-500 text-white text-xs gap-1.5">
            <Plus className="h-4 w-4" />
            <span>Input Surat Jalan Baru (Draft)</span>
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="border-border p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-2 w-full sm:w-80">
            <Input
              placeholder="Cari No. SJ / Plat / Supir / Supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(['ALL', 'DRAFT', 'WAITING', 'COUNTING', 'COMPLETED', 'CANCELLED'] as const).map((tab) => (
              <Badge
                key={tab}
                variant={activeTab === tab ? 'default' : 'outline'}
                onClick={() => setActiveTab(tab)}
                className={`cursor-pointer transition-colors ${
                  activeTab === tab ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'hover:bg-slate-100'
                }`}
              >
                {tab === 'ALL' ? 'Semua' : tab}
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Receivings Table */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Daftar Surat Jalan Penerimaan</CardTitle>
          <CardDescription className="text-xs">
            Actual count dihitung otomatis secara derivatif dari log sensor dan tidak dapat diedit manual.
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
        onSuccess={fetchReceivings}
      />

      <ReceivingCancelDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        receivingId={receivingToCancel?.id || null}
        deliveryNoteNumber={receivingToCancel?.deliveryNoteNumber || ''}
        onSuccess={fetchReceivings}
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
