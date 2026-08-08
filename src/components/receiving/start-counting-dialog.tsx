'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlayCircle, AlertCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface StartCountingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivingId: string | null;
  deliveryNoteNumber: string;
  isAdmin: boolean;
}

export function StartCountingDialog({
  open,
  onOpenChange,
  receivingId,
  deliveryNoteNumber,
  isAdmin,
}: StartCountingDialogProps) {
  const router = useRouter();
  const [lines, setLines] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [loadingLines, setLoadingLines] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch lines when dialog opens
  useEffect(() => {
    if (!open) return;
    
    async function fetchLines() {
      setLoadingLines(true);
      setErrorMsg('');
      try {
        const res = await fetch('/api/lines');
        if (!res.ok) throw new Error('Gagal mengambil data Line');
        const data = await res.json();
        setLines(data.lines || []);
        if (data.lines?.length > 0) {
          setSelectedLineId(data.lines[0].id);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Terjadi kesalahan sistem');
      } finally {
        setLoadingLines(false);
      }
    }
    
    fetchLines();
  }, [open]);

  const handleStart = async () => {
    if (!receivingId) return;
    if (!selectedLineId) {
      setErrorMsg('Pilih Jalur (Line) terlebih dahulu');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiving_id: receivingId,
          line_id: selectedLineId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Gagal memulai sesi penghitungan');
      }

      onOpenChange(false);
      
      // Redirect to counting console
      if (isAdmin) {
        router.push('/admin/counting');
      } else {
        router.push('/active-session');
      }
      
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-700">
            <PlayCircle className="h-5 w-5" />
            Mulai Penghitungan
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pilih jalur operasional (Line) untuk mulai menghitung Surat Jalan <strong>{deliveryNoteNumber}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md border border-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="line-select" className="text-xs font-medium">
              Jalur (Line) Operasional
            </label>
            {loadingLines ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat Jalur...
              </div>
            ) : (
              <select
                id="line-select"
                value={selectedLineId}
                onChange={(e) => setSelectedLineId(e.target.value)}
                className="w-full flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="" disabled>-- Pilih Jalur --</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Batal
          </Button>
          <Button 
            onClick={handleStart} 
            disabled={isSubmitting || !selectedLineId || loadingLines}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memulai...
              </>
            ) : (
              'Mulai Sekarang'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
