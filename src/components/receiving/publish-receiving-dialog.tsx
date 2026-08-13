'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Send } from 'lucide-react';
import type { ReceivingData } from '@/components/receiving/queue-table';

interface PublishReceivingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiving: ReceivingData | null;
  onSuccess: () => void;
}

export function PublishReceivingDialog({
  open,
  onOpenChange,
  receiving,
  onSuccess,
}: PublishReceivingDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!receiving) return null;

  const handleConfirmPublish = async () => {
    try {
      setSubmitting(true);
      setErrorMsg('');

      const res = await fetch(`/api/receivings/${receiving.id}/publish`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Gagal menerbitkan Surat Jalan.');
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan server.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-5 text-primary" />
            <span>Terbitkan Surat Jalan ke Antrean</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Surat jalan yang diterbitkan akan berpindah status ke <strong>Menunggu (WAITING)</strong> dan siap untuk dimulainya proses penghitungan.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-xs">
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">No. Surat Jalan:</span>
            <span className="font-semibold text-foreground">{receiving.deliveryNoteNumber}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Truk / Plat Nomor:</span>
            <span className="font-medium text-foreground">{receiving.licensePlateSnapshot || '—'}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Supplier:</span>
            <span className="font-medium text-foreground">{receiving.supplierNameSnapshot || '—'}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Total Manifest:</span>
            <span className="font-semibold tabular-nums text-foreground">
              {receiving.manifestCount.toLocaleString('id-ID')} ekor
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Jalur Tujuan:</span>
            <span className="font-medium text-foreground">{receiving.lineName || (receiving as any).line?.name || '—'}</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="min-h-[44px] sm:min-h-0"
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleConfirmPublish}
            disabled={submitting}
            className="gap-2 min-h-[44px] sm:min-h-0"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Menerbitkan...</span>
              </>
            ) : (
              <>
                <Send className="size-4" />
                <span>Terbitkan Sekarang</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
