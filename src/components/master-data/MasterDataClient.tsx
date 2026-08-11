'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  UserCheck,
  Building2,
  Plus,
  Search,
  Pencil,
  Power,
  RefreshCw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusBadge as UiStatusBadge } from '@/components/ui/status-badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Truck {
  id: string;
  licensePlate: string;
  carrierName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Driver {
  id: string;
  name: string;
  phone: string | null;
  licenseNumber: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Supplier {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <UiStatusBadge tone={status === 'ACTIVE' ? 'success' : 'neutral'} className="text-[10px]">
      {status === 'ACTIVE' ? 'AKTIF' : 'NONAKTIF'}
    </UiStatusBadge>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  onAdd,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-purple-600" />
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button
        id={`btn-add-${title.toLowerCase().replace(/\s/g, '-')}`}
        size="sm"
        variant="outline"
        className="h-7 text-[11px] gap-1"
        onClick={onAdd}
      >
        <Plus className="h-3 w-3" /> Tambah
      </Button>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <AlertCircle className="h-6 w-6 text-destructive" />
      <p className="text-xs text-muted-foreground">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry} className="gap-1">
        <RefreshCw className="h-3 w-3" /> Coba Lagi
      </Button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex justify-center items-center py-10">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-8 text-center text-xs text-muted-foreground">{label} belum ada.</div>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────────

function FormField({
  label,
  required,
  children,
  error,
  htmlFor,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── TRUCKS Section ───────────────────────────────────────────────────────────

function TrucksSection() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Truck | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [licensePlate, setLicensePlate] = useState('');
  const [carrierName, setCarrierName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await fetch(`/api/trucks?${params}`);
      if (!res.ok) throw new Error('Gagal memuat data truck.');
      const data = await res.json();
      setTrucks(data.trucks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditTarget(null);
    setLicensePlate('');
    setCarrierName('');
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(truck: Truck) {
    setEditTarget(truck);
    setLicensePlate(truck.licensePlate);
    setCarrierName(truck.carrierName ?? '');
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!licensePlate.trim()) {
      setFormError('Plat nomor wajib diisi.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        licensePlate: licensePlate.trim(),
        carrierName: carrierName.trim() || null,
      };

      let res: Response;
      if (editTarget) {
        res = await fetch(`/api/trucks/${editTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/trucks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? 'Gagal menyimpan.');
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(truck: Truck) {
    try {
      const newStatus = truck.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const res = await fetch(`/api/trucks/${truck.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Gagal mengubah status.');
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Truck}
          title="Master Truck"
          description="Daftar armada penerimaan"
          onAdd={openCreate}
        />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="trucks-search"
              placeholder="Cari plat / nama armada..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <select
            id="trucks-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
            className="h-8 text-xs border border-input rounded-md px-2 bg-background"
          >
            <option value="ALL">Semua</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="px-4 pb-4"><ErrorState message={error} onRetry={load} /></div>
        ) : trucks.length === 0 ? (
          <EmptyState label="Truck" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Plat Nomor</TableHead>
                <TableHead className="text-xs">Nama Armada</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trucks.map((truck) => (
                <TableRow key={truck.id}>
                  <TableCell className="text-xs font-bold text-purple-700 dark:text-purple-400">
                    {truck.licensePlate}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {truck.carrierName ?? '-'}
                  </TableCell>
                  <TableCell><StatusBadge status={truck.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        id={`btn-edit-truck-${truck.id}`}
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => openEdit(truck)}
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        id={`btn-toggle-truck-${truck.id}`}
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => handleToggleStatus(truck)}
                        title={truck.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        <Power className={`h-3 w-3 ${truck.status === 'ACTIVE' ? 'text-green-600' : 'text-slate-400'}`} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>{editTarget ? 'Edit Truck' : 'Tambah Truck'}</DialogTitle>
          <DialogDescription>
            {editTarget ? `Perbarui data truck ${editTarget.licensePlate}` : 'Daftarkan armada baru ke sistem.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
          <FormField label="Plat Nomor" htmlFor="truck-form-license-plate" required>
            <Input
              id="truck-form-license-plate"
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
              placeholder="Contoh: B 1234 ABC"
              maxLength={20}
              className="text-xs uppercase"
            />
          </FormField>
          <FormField label="Nama Armada / Carrier" htmlFor="truck-form-carrier-name">
            <Input
              id="truck-form-carrier-name"
              value={carrierName}
              onChange={(e) => setCarrierName(e.target.value)}
              placeholder="Opsional"
              maxLength={100}
              className="text-xs"
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button
            id="btn-truck-form-cancel"
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(false)}
            disabled={saving}
          >
            Batal
          </Button>
          <Button
            id="btn-truck-form-save"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-1"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {editTarget ? 'Simpan Perubahan' : 'Tambah Truck'}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── DRIVERS Section ──────────────────────────────────────────────────────────

function DriversSection() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Driver | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await fetch(`/api/drivers?${params}`);
      if (!res.ok) throw new Error('Gagal memuat data supir.');
      const data = await res.json();
      setDrivers(data.drivers ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditTarget(null);
    setName('');
    setPhone('');
    setLicenseNumber('');
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(driver: Driver) {
    setEditTarget(driver);
    setName(driver.name);
    setPhone(driver.phone ?? '');
    setLicenseNumber(driver.licenseNumber ?? '');
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      setFormError('Nama supir wajib diisi.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        licenseNumber: licenseNumber.trim() || null,
      };

      let res: Response;
      if (editTarget) {
        res = await fetch(`/api/drivers/${editTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/drivers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? 'Gagal menyimpan.');
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(driver: Driver) {
    try {
      const newStatus = driver.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const res = await fetch(`/api/drivers/${driver.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Gagal mengubah status.');
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <SectionHeader
          icon={UserCheck}
          title="Master Supir"
          description="Daftar pengemudi terdaftar"
          onAdd={openCreate}
        />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="drivers-search"
              placeholder="Cari nama / SIM..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <select
            id="drivers-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
            className="h-8 text-xs border border-input rounded-md px-2 bg-background"
          >
            <option value="ALL">Semua</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="px-4 pb-4"><ErrorState message={error} onRetry={load} /></div>
        ) : drivers.length === 0 ? (
          <EmptyState label="Supir" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nama</TableHead>
                <TableHead className="text-xs">No. SIM</TableHead>
                <TableHead className="text-xs">Telepon</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((driver) => (
                <TableRow key={driver.id}>
                  <TableCell className="text-xs font-medium">{driver.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{driver.licenseNumber ?? '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{driver.phone ?? '-'}</TableCell>
                  <TableCell><StatusBadge status={driver.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        id={`btn-edit-driver-${driver.id}`}
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => openEdit(driver)}
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        id={`btn-toggle-driver-${driver.id}`}
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => handleToggleStatus(driver)}
                        title={driver.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        <Power className={`h-3 w-3 ${driver.status === 'ACTIVE' ? 'text-green-600' : 'text-slate-400'}`} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>{editTarget ? 'Edit Supir' : 'Tambah Supir'}</DialogTitle>
          <DialogDescription>
            {editTarget ? `Perbarui data supir ${editTarget.name}` : 'Daftarkan pengemudi baru ke sistem.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
          <FormField label="Nama Lengkap" htmlFor="driver-form-name" required>
            <Input
              id="driver-form-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama pengemudi"
              maxLength={100}
              className="text-xs"
            />
          </FormField>
          <FormField label="Nomor SIM" htmlFor="driver-form-license">
            <Input
              id="driver-form-license"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="Opsional"
              maxLength={50}
              className="text-xs"
            />
          </FormField>
          <FormField label="Nomor Telepon" htmlFor="driver-form-phone">
            <Input
              id="driver-form-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Opsional"
              maxLength={30}
              className="text-xs"
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button
            id="btn-driver-form-cancel"
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(false)}
            disabled={saving}
          >
            Batal
          </Button>
          <Button
            id="btn-driver-form-save"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-1"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {editTarget ? 'Simpan Perubahan' : 'Tambah Supir'}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── SUPPLIERS Section ────────────────────────────────────────────────────────

function SuppliersSection() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await fetch(`/api/suppliers?${params}`);
      if (!res.ok) throw new Error('Gagal memuat data supplier.');
      const data = await res.json();
      setSuppliers(data.suppliers ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditTarget(null);
    setCode('');
    setName('');
    setAddress('');
    setPhone('');
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditTarget(supplier);
    setCode(supplier.code);
    setName(supplier.name);
    setAddress(supplier.address ?? '');
    setPhone(supplier.phone ?? '');
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!code.trim()) { setFormError('Kode supplier wajib diisi.'); return; }
    if (!name.trim()) { setFormError('Nama supplier wajib diisi.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
      };

      let res: Response;
      if (editTarget) {
        res = await fetch(`/api/suppliers/${editTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? 'Gagal menyimpan.');
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(supplier: Supplier) {
    try {
      const newStatus = supplier.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const res = await fetch(`/api/suppliers/${supplier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Gagal mengubah status.');
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Building2}
          title="Master Supplier / Farm"
          description="Daftar mitra peternakan"
          onAdd={openCreate}
        />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="suppliers-search"
              placeholder="Cari nama / kode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <select
            id="suppliers-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
            className="h-8 text-xs border border-input rounded-md px-2 bg-background"
          >
            <option value="ALL">Semua</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="px-4 pb-4"><ErrorState message={error} onRetry={load} /></div>
        ) : suppliers.length === 0 ? (
          <EmptyState label="Supplier" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Kode</TableHead>
                <TableHead className="text-xs">Nama</TableHead>
                <TableHead className="text-xs">Telepon</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="text-xs font-bold text-purple-700 dark:text-purple-400">
                    {supplier.code}
                  </TableCell>
                  <TableCell className="text-xs font-medium">{supplier.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{supplier.phone ?? '-'}</TableCell>
                  <TableCell><StatusBadge status={supplier.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        id={`btn-edit-supplier-${supplier.id}`}
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => openEdit(supplier)}
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        id={`btn-toggle-supplier-${supplier.id}`}
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => handleToggleStatus(supplier)}
                        title={supplier.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        <Power className={`h-3 w-3 ${supplier.status === 'ACTIVE' ? 'text-green-600' : 'text-slate-400'}`} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>{editTarget ? 'Edit Supplier' : 'Tambah Supplier'}</DialogTitle>
          <DialogDescription>
            {editTarget ? `Perbarui data supplier ${editTarget.name}` : 'Daftarkan mitra peternakan baru.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
          <FormField label="Kode Supplier" htmlFor="supplier-form-code" required>
            <Input
              id="supplier-form-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Contoh: FARM-001"
              maxLength={50}
              className="text-xs uppercase"
            />
          </FormField>
          <FormField label="Nama Supplier / Farm" htmlFor="supplier-form-name" required>
            <Input
              id="supplier-form-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama lengkap"
              maxLength={100}
              className="text-xs"
            />
          </FormField>
          <FormField label="Nomor Telepon" htmlFor="supplier-form-phone">
            <Input
              id="supplier-form-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Opsional"
              maxLength={30}
              className="text-xs"
            />
          </FormField>
          <FormField label="Alamat" htmlFor="supplier-form-address">
            <Textarea
              id="supplier-form-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Opsional"
              className="min-h-20 resize-none text-xs"
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button
            id="btn-supplier-form-cancel"
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(false)}
            disabled={saving}
          >
            Batal
          </Button>
          <Button
            id="btn-supplier-form-save"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-1"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {editTarget ? 'Simpan Perubahan' : 'Tambah Supplier'}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function MasterDataClient() {
  return (
    <div className="space-y-6">
      <PageHeader title="Kelola Master Data" description="Manajemen acuan Truck, Supir, dan Supplier. Receiving menyimpan snapshot agar data historis terlindungi." />

      <div className="grid grid-cols-1 gap-6">
        <TrucksSection />
        <DriversSection />
        <SuppliersSection />
      </div>
    </div>
  );
}
