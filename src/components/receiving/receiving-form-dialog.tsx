'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { AlertCircle, FileText, Truck, User, Building2, Hash, Calendar, Layers } from 'lucide-react';

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
  const [receivingDate, setReceivingDate] = useState(new Date().toISOString().split('T')[0]);
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
        setReceivingDate(receivingToEdit.receivingDate || new Date().toISOString().split('T')[0]);
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
      } else {
        setDeliveryNoteNumber('');
        setReceivingDate(new Date().toISOString().split('T')[0]);
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

  const handleTruckSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setTruckId(val);
    const found = trucks.find((t) => t.id === val);
    if (found) {
      setLicensePlateSnapshot(found.licensePlate);
    }
  };

  const handleDriverSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setDriverId(val);
    const found = drivers.find((d) => d.id === val);
    if (found) {
      setDriverNameSnapshot(found.name);
    }
  };

  const handleSupplierSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
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
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-purple-600" />
          <span>{isEditing ? 'Edit / Revisi Surat Jalan' : 'Input Surat Jalan Baru (Draft)'}</span>
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Perbarui data Surat Jalan. Revisi manifest pada status WAITING memerlukan alasan audit.'
            : 'Isi data manifest dari Surat Jalan pengiriman ayam secara akurat.'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <DialogContent className="space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isManifestChanged && (
            <div className="p-3 text-xs bg-amber-50 text-amber-900 border border-amber-300 rounded-lg space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                <AlertCircle className="h-4 w-4" />
                Perhatian: Revisi Manifest pada Status WAITING
              </div>
              <p>
                Jumlah manifest diubah dari <strong>{receivingToEdit?.manifestCount}</strong> menjadi{' '}
                <strong>{manifestCount}</strong> ekor. Perubahan ini akan dicatat ke audit log dan riwayat revisi.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-slate-500" /> No. Surat Jalan *
              </label>
              <Input
                value={deliveryNoteNumber}
                onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                placeholder="misal: SJ-2026-0807-001"
                required
                className="text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-500" /> Tanggal Penerimaan *
              </label>
              <Input
                type="date"
                value={receivingDate}
                onChange={(e) => setReceivingDate(e.target.value)}
                required
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                <Truck className="h-3.5 w-3.5 text-slate-500" /> Pilih Truck Master (Opsional)
              </label>
              <select
                value={truckId}
                onChange={handleTruckSelect}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">-- Pilih Truck --</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.licensePlate} {t.carrierName ? `(${t.carrierName})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Plat Nomor Truck (Snapshot) *</label>
              <Input
                value={licensePlateSnapshot}
                onChange={(e) => setLicensePlateSnapshot(e.target.value)}
                placeholder="misal: B 9101 RPA"
                required
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-slate-500" /> Pilih Supir Master (Opsional)
              </label>
              <select
                value={driverId}
                onChange={handleDriverSelect}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">-- Pilih Supir --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.phone ? `(${d.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Nama Supir (Snapshot) *</label>
              <Input
                value={driverNameSnapshot}
                onChange={(e) => setDriverNameSnapshot(e.target.value)}
                placeholder="misal: Budi Santoso"
                required
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-slate-500" /> Pilih Supplier Master (Opsional)
              </label>
              <select
                value={supplierId}
                onChange={handleSupplierSelect}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">-- Pilih Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Nama Supplier (Snapshot) *</label>
              <Input
                value={supplierNameSnapshot}
                onChange={(e) => setSupplierNameSnapshot(e.target.value)}
                placeholder="misal: Farm Sukses Mandiri"
                required
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                <Hash className="h-3.5 w-3.5 text-slate-500" /> Jumlah Manifest (Ekor) *
              </label>
              <Input
                type="number"
                min="1"
                value={manifestCount}
                onChange={(e) => setManifestCount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="5000"
                required
                className="text-xs font-bold text-purple-700 dark:text-purple-400"
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-slate-500" /> Jalur Line Penerimaan
              </label>
              <select
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">-- Belum Ditentukan --</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.lineCode} - {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Posisi Antrean</label>
              <Input
                type="number"
                min="1"
                value={queuePosition}
                onChange={(e) => setQueuePosition(Number(e.target.value))}
                className="text-xs"
              />
            </div>
          </div>

          {isManifestChanged && (
            <div>
              <label className="text-xs font-semibold mb-1 block text-amber-800 dark:text-amber-400">
                Alasan Revisi Manifest *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Jelaskan alasan perubahan jumlah manifest (misal: koreksi fisik dari vendor)..."
                required
                rows={2}
                className="w-full p-2.5 rounded-md border border-amber-300 bg-amber-50/50 dark:bg-amber-950/30 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium mb-1 block">Catatan Tambahan</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan opsional mengenai pengiriman..."
              rows={2}
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
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs"
          >
            {loading ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Simpan Draft'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
