'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/components/ui/sonner';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
      toast.success('Penghitungan berhasil dimulai.');
      
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
          <DialogTitle className="flex items-center gap-2 text-primary">
            <PlayCircle className="h-5 w-5" />
            Mulai Penghitungan
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pilih jalur operasional (Line) untuk mulai menghitung Surat Jalan <strong>{deliveryNoteNumber}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {errorMsg && (
            <Alert variant="destructive"><AlertCircle /><AlertDescription>{errorMsg}</AlertDescription></Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="line-select">
              Jalur (Line) Operasional
            </Label>
            {loadingLines ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat Jalur...
              </div>
            ) : (
              <Select value={selectedLineId} onValueChange={setSelectedLineId}>
                <SelectTrigger id="line-select" className="w-full"><SelectValue placeholder="Pilih Jalur" /></SelectTrigger>
                <SelectContent>
                {lines.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
                </SelectContent>
              </Select>
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
