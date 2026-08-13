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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useUrlFilters } from '@/lib/use-url-filters';
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
    <UiStatusBadge tone={status === 'ACTIVE' ? 'success' : 'neutral'}>
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
        <Icon className="h-4 w-4 text-primary" />
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button
        id={`btn-add-${title.toLowerCase().replace(/\s/g, '-')}`}
        size="sm"
        className="gap-1 min-h-[44px] sm:min-h-0"
        onClick={onAdd}
      >
        <Plus className="h-3.5 w-3.5" /> Tambah
      </Button>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <AlertCircle className="h-6 w-6 text-destructive" />
      <p className="text-xs text-muted-foreground">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry} className="gap-1 min-h-[44px] sm:min-h-0">
        <RefreshCw className="h-3 w-3" /> Coba Lagi
      </Button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3 p-4" role="status" aria-label="Memuat data" aria-busy="true">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-3/4" />
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
      if (!res.ok) throw new Error('Gagal memuat data truk.');
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
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Truck}
          title="Master Truk"
          description="Daftar armada penerimaan"
          onAdd={openCreate}
        />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="trucks-search"
              placeholder="Cari plat / nama armada..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs min-h-[44px] sm:min-h-0"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'ALL' | 'ACTIVE' | 'INACTIVE')}>
            <SelectTrigger id="trucks-status-filter" size="sm" className="w-28 min-h-[44px] sm:min-h-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              <SelectItem value="ACTIVE">Aktif</SelectItem>
              <SelectItem value="INACTIVE">Nonaktif</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="px-4 pb-4"><ErrorState message={error} onRetry={load} /></div>
        ) : trucks.length === 0 ? (
          <EmptyState label="Truk" />
        ) : (
          <>
            {/* Mobile Cards View (< md) */}
            <div className="divide-y divide-border md:hidden">
              {trucks.map((truck) => (
                <div key={truck.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{truck.licensePlate}</p>
                    <p className="text-muted-foreground">{truck.carrierName || 'Armada —'}</p>
                    <div><StatusBadge status={truck.status} /></div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      id={`btn-edit-truck-mobile-${truck.id}`}
                      size="sm"
                      variant="outline"
                      className="h-9 w-9 p-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                      onClick={() => openEdit(truck)}
                      title="Edit Truk"
                      aria-label="Edit Truk"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      id={`btn-toggle-truck-mobile-${truck.id}`}
                      size="sm"
                      variant="outline"
                      className="h-9 w-9 p-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                      onClick={() => handleToggleStatus(truck)}
                      title={truck.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                      aria-label={truck.status === 'ACTIVE' ? 'Nonaktifkan Truk' : 'Aktifkan Truk'}
                    >
                      <Power className={`h-3.5 w-3.5 ${truck.status === 'ACTIVE' ? 'text-success' : 'text-muted-foreground'}`} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="text-xs">Plat Nomor</TableHead>
                    <TableHead className="text-xs">Nama Armada</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs w-[100px] text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trucks.map((truck) => (
                    <TableRow key={truck.id}>
                      <TableCell className="text-xs font-medium">
                        {truck.licensePlate}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {truck.carrierName ?? '-'}
                      </TableCell>
                      <TableCell><StatusBadge status={truck.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            id={`btn-edit-truck-${truck.id}`}
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => openEdit(truck)}
                            title="Edit"
                            aria-label="Edit Truk"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            id={`btn-toggle-truck-${truck.id}`}
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => handleToggleStatus(truck)}
                            title={truck.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                            aria-label={truck.status === 'ACTIVE' ? 'Nonaktifkan Truk' : 'Aktifkan Truk'}
                          >
                            <Power className={`h-3.5 w-3.5 ${truck.status === 'ACTIVE' ? 'text-success' : 'text-muted-foreground'}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Truk' : 'Tambah Truk'}</DialogTitle>
            <DialogDescription>
              {editTarget ? `Perbarui data truk ${editTarget.licensePlate}` : 'Daftarkan armada baru ke sistem.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <FormField label="Plat Nomor" htmlFor="truck-form-license-plate" required>
              <Input
                id="truck-form-license-plate"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                placeholder="Contoh: B 1234 ABC"
                maxLength={20}
                className="text-xs uppercase min-h-[44px] sm:min-h-0"
              />
            </FormField>
            <FormField label="Nama Armada / Carrier" htmlFor="truck-form-carrier-name">
              <Input
                id="truck-form-carrier-name"
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                placeholder="Opsional"
                maxLength={100}
                className="text-xs min-h-[44px] sm:min-h-0"
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
              className="min-h-[44px] sm:min-h-0"
            >
              Batal
            </Button>
            <Button
              id="btn-truck-form-save"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1 min-h-[44px] sm:min-h-0"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editTarget ? 'Simpan Perubahan' : 'Tambah Truk'}
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
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader
          icon={UserCheck}
          title="Master Supir"
          description="Daftar pengemudi terdaftar"
          onAdd={openCreate}
        />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="drivers-search"
              placeholder="Cari nama / SIM..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs min-h-[44px] sm:min-h-0"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'ALL' | 'ACTIVE' | 'INACTIVE')}>
            <SelectTrigger id="drivers-status-filter" size="sm" className="w-28 min-h-[44px] sm:min-h-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              <SelectItem value="ACTIVE">Aktif</SelectItem>
              <SelectItem value="INACTIVE">Nonaktif</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="px-4 pb-4"><ErrorState message={error} onRetry={load} /></div>
        ) : drivers.length === 0 ? (
          <EmptyState label="Supir" />
        ) : (
          <>
            {/* Mobile Cards View (< md) */}
            <div className="divide-y divide-border md:hidden">
              {drivers.map((driver) => (
                <div key={driver.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{driver.name}</p>
                    <p className="text-muted-foreground">SIM: {driver.licenseNumber || '—'} • Telp: {driver.phone || '—'}</p>
                    <div><StatusBadge status={driver.status} /></div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      id={`btn-edit-driver-mobile-${driver.id}`}
                      size="sm"
                      variant="outline"
                      className="h-9 w-9 p-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                      onClick={() => openEdit(driver)}
                      title="Edit Supir"
                      aria-label="Edit Supir"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      id={`btn-toggle-driver-mobile-${driver.id}`}
                      size="sm"
                      variant="outline"
                      className="h-9 w-9 p-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                      onClick={() => handleToggleStatus(driver)}
                      title={driver.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                      aria-label={driver.status === 'ACTIVE' ? 'Nonaktifkan Supir' : 'Aktifkan Supir'}
                    >
                      <Power className={`h-3.5 w-3.5 ${driver.status === 'ACTIVE' ? 'text-success' : 'text-muted-foreground'}`} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="text-xs">Nama</TableHead>
                    <TableHead className="text-xs">No. SIM</TableHead>
                    <TableHead className="text-xs">Telepon</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs w-[100px] text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell className="text-xs font-medium">{driver.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{driver.licenseNumber ?? '-'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{driver.phone ?? '-'}</TableCell>
                      <TableCell><StatusBadge status={driver.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            id={`btn-edit-driver-${driver.id}`}
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => openEdit(driver)}
                            title="Edit"
                            aria-label="Edit Supir"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            id={`btn-toggle-driver-${driver.id}`}
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => handleToggleStatus(driver)}
                            title={driver.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                            aria-label={driver.status === 'ACTIVE' ? 'Nonaktifkan Supir' : 'Aktifkan Supir'}
                          >
                            <Power className={`h-3.5 w-3.5 ${driver.status === 'ACTIVE' ? 'text-success' : 'text-muted-foreground'}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
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
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <FormField label="Nama Supir" htmlFor="driver-form-name" required>
              <Input
                id="driver-form-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama lengkap"
                maxLength={100}
                className="text-xs min-h-[44px] sm:min-h-0"
              />
            </FormField>
            <FormField label="Nomor Telepon" htmlFor="driver-form-phone">
              <Input
                id="driver-form-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Opsional"
                maxLength={30}
                className="text-xs min-h-[44px] sm:min-h-0"
              />
            </FormField>
            <FormField label="Nomor SIM" htmlFor="driver-form-license">
              <Input
                id="driver-form-license"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="Opsional"
                maxLength={50}
                className="text-xs min-h-[44px] sm:min-h-0"
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
              className="min-h-[44px] sm:min-h-0"
            >
              Batal
            </Button>
            <Button
              id="btn-driver-form-save"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1 min-h-[44px] sm:min-h-0"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader
          icon={Building2}
          title="Master Supplier / Farm"
          description="Daftar mitra peternakan"
          onAdd={openCreate}
        />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="suppliers-search"
              placeholder="Cari nama / kode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs min-h-[44px] sm:min-h-0"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'ALL' | 'ACTIVE' | 'INACTIVE')}>
            <SelectTrigger id="suppliers-status-filter" size="sm" className="w-28 min-h-[44px] sm:min-h-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              <SelectItem value="ACTIVE">Aktif</SelectItem>
              <SelectItem value="INACTIVE">Nonaktif</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="px-4 pb-4"><ErrorState message={error} onRetry={load} /></div>
        ) : suppliers.length === 0 ? (
          <EmptyState label="Supplier" />
        ) : (
          <>
            {/* Mobile Cards View (< md) */}
            <div className="divide-y divide-border md:hidden">
              {suppliers.map((supplier) => (
                <div key={supplier.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{supplier.name} <span className="font-mono text-muted-foreground font-normal">({supplier.code})</span></p>
                    <p className="text-muted-foreground">Telp: {supplier.phone || '—'}</p>
                    <div><StatusBadge status={supplier.status} /></div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      id={`btn-edit-supplier-mobile-${supplier.id}`}
                      size="sm"
                      variant="outline"
                      className="h-9 w-9 p-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                      onClick={() => openEdit(supplier)}
                      title="Edit Supplier"
                      aria-label="Edit Supplier"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      id={`btn-toggle-supplier-mobile-${supplier.id}`}
                      size="sm"
                      variant="outline"
                      className="h-9 w-9 p-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                      onClick={() => handleToggleStatus(supplier)}
                      title={supplier.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                      aria-label={supplier.status === 'ACTIVE' ? 'Nonaktifkan Supplier' : 'Aktifkan Supplier'}
                    >
                      <Power className={`h-3.5 w-3.5 ${supplier.status === 'ACTIVE' ? 'text-success' : 'text-muted-foreground'}`} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="text-xs">Kode</TableHead>
                    <TableHead className="text-xs">Nama</TableHead>
                    <TableHead className="text-xs">Telepon</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs w-[100px] text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="text-xs font-medium">
                        {supplier.code}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{supplier.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{supplier.phone ?? '-'}</TableCell>
                      <TableCell><StatusBadge status={supplier.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            id={`btn-edit-supplier-${supplier.id}`}
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => openEdit(supplier)}
                            title="Edit"
                            aria-label="Edit Supplier"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            id={`btn-toggle-supplier-${supplier.id}`}
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => handleToggleStatus(supplier)}
                            title={supplier.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                            aria-label={supplier.status === 'ACTIVE' ? 'Nonaktifkan Supplier' : 'Aktifkan Supplier'}
                          >
                            <Power className={`h-3.5 w-3.5 ${supplier.status === 'ACTIVE' ? 'text-success' : 'text-muted-foreground'}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
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
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <FormField label="Kode Supplier" htmlFor="supplier-form-code" required>
              <Input
                id="supplier-form-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Contoh: FARM-001"
                maxLength={50}
                className="text-xs uppercase min-h-[44px] sm:min-h-0"
              />
            </FormField>
            <FormField label="Nama Supplier / Farm" htmlFor="supplier-form-name" required>
              <Input
                id="supplier-form-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama lengkap"
                maxLength={100}
                className="text-xs min-h-[44px] sm:min-h-0"
              />
            </FormField>
            <FormField label="Nomor Telepon" htmlFor="supplier-form-phone">
              <Input
                id="supplier-form-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Opsional"
                maxLength={30}
                className="text-xs min-h-[44px] sm:min-h-0"
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
              className="min-h-[44px] sm:min-h-0"
            >
              Batal
            </Button>
            <Button
              id="btn-supplier-form-save"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1 min-h-[44px] sm:min-h-0"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
  const { filters, setFilter } = useUrlFilters({
    section: 'trucks',
  });

  const activeTab = filters.section === 'drivers' || filters.section === 'suppliers' ? filters.section : 'trucks';

  return (
    <div className="space-y-6">
      <PageHeader title="Kelola Master Data" description="Manajemen acuan Truk, Supir, dan Supplier. Receiving menyimpan snapshot agar data historis terlindungi." />

      <Tabs value={activeTab} onValueChange={(val) => setFilter('section', val)} className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
          <TabsTrigger value="trucks" className="gap-2">
            <Truck className="size-4" />
            <span>Truk</span>
          </TabsTrigger>
          <TabsTrigger value="drivers" className="gap-2">
            <UserCheck className="size-4" />
            <span>Supir</span>
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2">
            <Building2 className="size-4" />
            <span>Supplier</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trucks" className="mt-4">
          <TrucksSection />
        </TabsContent>

        <TabsContent value="drivers" className="mt-4">
          <DriversSection />
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <SuppliersSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
