'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';

interface ReceivingCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivingId: string | null;
  deliveryNoteNumber: string;
  onSuccess: () => void;
}

export function ReceivingCancelDialog({
  open,
  onOpenChange,
  receivingId,
  deliveryNoteNumber,
  onSuccess,
}: ReceivingCancelDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingId) return;

    if (!reason.trim()) {
      setErrorMsg('Alasan pembatalan wajib diisi.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/receivings/${receivingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Gagal membatalkan Surat Jalan.');
      }

      onOpenChange(false);
      setReason('');
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-5 w-5" />
          <span>Batalkan Surat Jalan</span>
        </DialogTitle>
        <DialogDescription>
          Anda akan membatalkan Surat Jalan <strong>{deliveryNoteNumber}</strong>. Tindakan ini akan dicatat ke dalam audit log.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleCancel} className="flex flex-col flex-1 overflow-hidden">
        <DialogContent className="space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold mb-1.5 block">
              Alasan Pembatalan *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Berikan alasan mengapa Surat Jalan ini dibatalkan (misal: truck dipindahkan/dibatalkan)..."
              required
              rows={3}
              className="w-full p-2.5 rounded-md border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </DialogContent>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs"
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-red-600 hover:bg-red-500 text-white text-xs"
          >
            {loading ? 'Proses...' : 'Ya, Batalkan Surat Jalan'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
