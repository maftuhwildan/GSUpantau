'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { AlertCircle, ChevronDown, Database, FileText, Layers, Truck } from 'lucide-react';
import { getTodayDateOnly } from '@/lib/ui-date';

interface ReceivingItem {
  id: string;
  receivingNumber?: string;
  deliveryNoteNumber: string;
  receivingDate: string;
  documentTruckSequence?: number | null;
  queuePosition: number;
  truckId?: string | null;
  licensePlateSnapshot: string;
  driverId?: string | null;
  driverNameSnapshot: string;
  supplierId?: string | null;
  supplierNameSnapshot: string;
  manifestCount: number;
  lineId?: string | null;
  status: string;
  notes?: string | null;
}

interface TruckOption {
  id: string;
  licensePlate: string;
  carrierName?: string | null;
}

interface DriverOption {
  id: string;
  name: string;
  phone?: string | null;
}

interface SupplierOption {
  id: string;
  code: string;
  name: string;
}

interface LineOption {
  id: string;
  lineCode: string;
  name: string;
}

interface ReceivingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivingToEdit?: ReceivingItem | null;
  onSuccess: () => void;
}

export function ReceivingFormDialog({
  open,
  onOpenChange,
  receivingToEdit,
  onSuccess,
}: ReceivingFormDialogProps) {
  const isEditing = Boolean(receivingToEdit);

  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [receivingDate, setReceivingDate] = useState(getTodayDateOnly);
  const [documentTruckSequence, setDocumentTruckSequence] = useState<number | ''>('');
  const [queuePosition, setQueuePosition] = useState<number>(1);
  const [truckId, setTruckId] = useState('');
  const [licensePlateSnapshot, setLicensePlateSnapshot] = useState('');
  const [driverId, setDriverId] = useState('');
  const [driverNameSnapshot, setDriverNameSnapshot] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supplierNameSnapshot, setSupplierNameSnapshot] = useState('');
  const [manifestCount, setManifestCount] = useState<number | ''>(5000);
  const [lineId, setLineId] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [masterDataOpen, setMasterDataOpen] = useState(false);

  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [lines, setLines] = useState<LineOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isWaiting = receivingToEdit?.status === 'WAITING';
  const isManifestChanged =
    isEditing &&
    isWaiting &&
    receivingToEdit &&
    Number(manifestCount) !== receivingToEdit.manifestCount;

  useEffect(() => {
    if (open) {
      fetchMasterData();
      if (receivingToEdit) {
        setDeliveryNoteNumber(receivingToEdit.deliveryNoteNumber || '');
        setReceivingDate(receivingToEdit.receivingDate || getTodayDateOnly());
        setDocumentTruckSequence(receivingToEdit.documentTruckSequence ?? '');
        setQueuePosition(receivingToEdit.queuePosition || 1);
        setTruckId(receivingToEdit.truckId || '');
        setLicensePlateSnapshot(receivingToEdit.licensePlateSnapshot || '');
        setDriverId(receivingToEdit.driverId || '');
        setDriverNameSnapshot(receivingToEdit.driverNameSnapshot || '');
        setSupplierId(receivingToEdit.supplierId || '');
        setSupplierNameSnapshot(receivingToEdit.supplierNameSnapshot || '');
        setManifestCount(receivingToEdit.manifestCount || 0);
        setLineId(receivingToEdit.lineId || '');
        setNotes(receivingToEdit.notes || '');
        setReason('');
        setMasterDataOpen(Boolean(receivingToEdit.truckId || receivingToEdit.driverId || receivingToEdit.supplierId));
      } else {
        setDeliveryNoteNumber('');
        setReceivingDate(getTodayDateOnly());
        setDocumentTruckSequence('');
        setQueuePosition(1);
        setTruckId('');
        setLicensePlateSnapshot('');
        setDriverId('');
        setDriverNameSnapshot('');
        setSupplierId('');
        setSupplierNameSnapshot('');
        setManifestCount(5000);
        setLineId('');
        setNotes('');
        setReason('');
        setMasterDataOpen(false);
      }
      setErrorMsg('');
    }
  }, [open, receivingToEdit]);

  async function fetchMasterData() {
    try {
      const [trRes, drRes, supRes, lnRes] = await Promise.all([
        fetch('/api/trucks').then((r) => r.json()),
        fetch('/api/drivers').then((r) => r.json()),
        fetch('/api/suppliers').then((r) => r.json()),
        fetch('/api/lines').then((r) => r.json()),
      ]);

      if (trRes.trucks) setTrucks(trRes.trucks);
      if (drRes.drivers) setDrivers(drRes.drivers);
      if (supRes.suppliers) setSuppliers(supRes.suppliers);
      if (lnRes.lines) setLines(lnRes.lines);
    } catch (err) {
      console.error('Failed to load master data:', err);
    }
  }

  const handleTruckSelect = (val: string) => {
    setTruckId(val);
    const found = trucks.find((t) => t.id === val);
    if (found) {
      setLicensePlateSnapshot(found.licensePlate);
    }
  };

  const handleDriverSelect = (val: string) => {
    setDriverId(val);
    const found = drivers.find((d) => d.id === val);
    if (found) {
      setDriverNameSnapshot(found.name);
    }
  };

  const handleSupplierSelect = (val: string) => {
    setSupplierId(val);
    const found = suppliers.find((s) => s.id === val);
    if (found) {
      setSupplierNameSnapshot(found.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (!deliveryNoteNumber.trim()) {
      setErrorMsg('Nomor Surat Jalan wajib diisi.');
      setLoading(false);
      return;
    }
    if (!licensePlateSnapshot.trim()) {
      setErrorMsg('Plat Nomor Truck wajib diisi.');
      setLoading(false);
      return;
    }
    if (!driverNameSnapshot.trim()) {
      setErrorMsg('Nama Supir wajib diisi.');
      setLoading(false);
      return;
    }
    if (!supplierNameSnapshot.trim()) {
      setErrorMsg('Nama Supplier wajib diisi.');
      setLoading(false);
      return;
    }
    if (!manifestCount || Number(manifestCount) <= 0) {
      setErrorMsg('Jumlah manifest harus lebih besar dari 0.');
      setLoading(false);
      return;
    }
    if (isManifestChanged && !reason.trim()) {
      setErrorMsg('Alasan revisi manifest wajib diisi untuk Surat Jalan yang sudah WAITING.');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        receiving_date: receivingDate,
        delivery_note_number: deliveryNoteNumber.trim(),
        document_truck_sequence: documentTruckSequence === '' ? null : Number(documentTruckSequence),
        queue_position: Number(queuePosition) || 1,
        truck_id: truckId || null,
        license_plate_snapshot: licensePlateSnapshot.trim(),
        driver_id: driverId || null,
        driver_name_snapshot: driverNameSnapshot.trim(),
        supplier_id: supplierId || null,
        supplier_name_snapshot: supplierNameSnapshot.trim(),
        manifest_count: Number(manifestCount),
        line_id: lineId || null,
        notes: notes.trim() || null,
        reason: reason.trim() || undefined,
      };

      const url = isEditing ? `/api/receivings/${receivingToEdit!.id}` : '/api/receivings';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error?.message || 'Gagal menyimpan Surat Jalan.');
      }

      onOpenChange(false);
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
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-hidden p-0 sm:max-w-2xl">
      <DialogHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
        <DialogTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <span>{isEditing ? 'Edit / Revisi Surat Jalan' : 'Input Surat Jalan Baru (Draft)'}</span>
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Perbarui data Surat Jalan. Revisi manifest pada status WAITING memerlukan alasan audit.'
            : 'Isi data manifest dari Surat Jalan pengiriman ayam secara akurat.'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <div className="max-h-[calc(100svh-13rem)] space-y-4 overflow-y-auto px-5 sm:px-6">
          {errorMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {isManifestChanged && (
            <Alert>
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertTitle>Perhatian: Revisi Manifest pada Status WAITING</AlertTitle>
              <AlertDescription>
                Jumlah manifest diubah dari <strong>{receivingToEdit?.manifestCount}</strong> menjadi{' '}
                <strong>{manifestCount}</strong> ekor. Perubahan ini akan dicatat ke audit log dan riwayat revisi.
              </AlertDescription>
            </Alert>
          )}

          <section className="space-y-3">
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <h3 className="text-sm font-medium">Data Surat Jalan</h3>
                <p className="text-xs text-muted-foreground">Identitas dokumen dan tanggal penerimaan.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="delivery-note-number">No. Surat Jalan *</Label>
                <Input
                  id="delivery-note-number"
                  value={deliveryNoteNumber}
                  onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                  placeholder="misal: SJ-2026-0807-001"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="receiving-date">Tanggal Penerimaan *</Label>
                <DatePicker
                  id="receiving-date"
                  value={receivingDate}
                  onValueChange={setReceivingDate}
                  required
                />
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <div className="flex items-start gap-2">
              <Truck className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <h3 className="text-sm font-medium">Identitas Pengiriman</h3>
                <p className="text-xs text-muted-foreground">Data snapshot wajib tersimpan bersama riwayat receiving.</p>
              </div>
            </div>

            <Collapsible open={masterDataOpen} onOpenChange={setMasterDataOpen} className="rounded-xl border">
              <div className="flex items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Database className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Isi dari data master</p>
                    <p className="text-xs text-muted-foreground">Opsional, untuk mengisi snapshot secara otomatis.</p>
                  </div>
                </div>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="group shrink-0">
                    {masterDataOpen ? 'Tutup' : 'Pilih data'}
                    <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="border-t px-3 pb-3 pt-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="truck-master">Truck master</Label>
                    <Select value={truckId} onValueChange={handleTruckSelect}>
                      <SelectTrigger id="truck-master" className="w-full"><SelectValue placeholder="Pilih truck" /></SelectTrigger>
                      <SelectContent>
                        {trucks.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.licensePlate} {t.carrierName ? `(${t.carrierName})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="driver-master">Supir master</Label>
                    <Select value={driverId} onValueChange={handleDriverSelect}>
                      <SelectTrigger id="driver-master" className="w-full"><SelectValue placeholder="Pilih supir" /></SelectTrigger>
                      <SelectContent>
                        {drivers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name} {d.phone ? `(${d.phone})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="supplier-master">Supplier master</Label>
                    <Select value={supplierId} onValueChange={handleSupplierSelect}>
                      <SelectTrigger id="supplier-master" className="w-full"><SelectValue placeholder="Pilih supplier" /></SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="license-plate-snapshot">Plat Nomor Truck (Snapshot) *</Label>
                <Input
                  id="license-plate-snapshot"
                  value={licensePlateSnapshot}
                  onChange={(e) => setLicensePlateSnapshot(e.target.value)}
                  placeholder="misal: B 9101 RPA"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="driver-name-snapshot">Nama Supir (Snapshot) *</Label>
                <Input
                  id="driver-name-snapshot"
                  value={driverNameSnapshot}
                  onChange={(e) => setDriverNameSnapshot(e.target.value)}
                  placeholder="misal: Budi Santoso"
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="supplier-name-snapshot">Nama Supplier (Snapshot) *</Label>
                <Input
                  id="supplier-name-snapshot"
                  value={supplierNameSnapshot}
                  onChange={(e) => setSupplierNameSnapshot(e.target.value)}
                  placeholder="misal: Farm Sukses Mandiri"
                  required
                />
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex items-start gap-2">
              <Layers className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <h3 className="text-sm font-medium">Data Operasional</h3>
                <p className="text-xs text-muted-foreground">Jumlah manifest, jalur, dan urutan receiving.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="manifest-count">Jumlah Manifest (Ekor) *</Label>
                <Input
                  id="manifest-count"
                  type="number"
                  min="1"
                  value={manifestCount}
                  onChange={(e) => setManifestCount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="5000"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="receiving-line">Jalur Line Penerimaan</Label>
                <Select value={lineId} onValueChange={setLineId}>
                  <SelectTrigger id="receiving-line" className="w-full"><SelectValue placeholder="Belum ditentukan" /></SelectTrigger>
                  <SelectContent>
                    {lines.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.lineCode} - {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="document-truck-sequence">Urutan Truck pada Dokumen</Label>
                <Input
                  id="document-truck-sequence"
                  type="number"
                  value={documentTruckSequence}
                  onChange={(e) => setDocumentTruckSequence(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Opsional"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="queue-position">Posisi Antrean</Label>
                <Input
                  id="queue-position"
                  type="number"
                  min="1"
                  value={queuePosition}
                  onChange={(e) => setQueuePosition(Number(e.target.value))}
                />
              </div>
            </div>
          </section>

          {isManifestChanged && (
            <div className="space-y-1.5">
              <Label htmlFor="manifest-revision-reason">Alasan Revisi Manifest *</Label>
              <Textarea
                id="manifest-revision-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Jelaskan alasan perubahan jumlah manifest, misalnya koreksi fisik dari vendor."
                required
                className="min-h-20"
              />
            </div>
          )}

          <Separator />

          <section className="space-y-1.5">
            <Label htmlFor="receiving-notes">Catatan Tambahan</Label>
            <Textarea
              id="receiving-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan opsional mengenai pengiriman."
              className="min-h-20"
            />
          </section>
        </div>

        <DialogFooter className="flex-row justify-end border-t px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={loading}
          >
            {loading ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Simpan Draft'}
          </Button>
        </DialogFooter>
      </form>
      </DialogContent>
    </Dialog>
  );
}
