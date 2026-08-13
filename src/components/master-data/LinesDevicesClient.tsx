'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Cpu,
  GitBranch,
  Key,
  Loader2,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useWebSocket } from '@/components/layout/ws-provider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { EmptyState, LoadingState } from '@/components/ui/states';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeviceView {
  id: string;
  deviceCode: string;
  name: string;
  lineId: string;
  status: string;
  storedStatus?: string;
  lastHeartbeatAt: string | null;
  firmwareVersion: string | null;
  wifiRssi: number | null;
}

interface LineView {
  id: string;
  lineCode: string;
  name: string;
  status: string;
  devices: DeviceView[];
}

// ─── Status Helpers ───────────────────────────────────────────────────────────

function deviceStatusVariant(status: string): StatusTone {
  if (status === 'ONLINE') return 'success';
  if (status === 'DEGRADED' || status === 'MAINTENANCE') return 'warning';
  if (status === 'OFFLINE') return 'danger';
  return 'neutral';
}

function lineStatusVariant(status: string): StatusTone {
  if (status === 'ACTIVE') return 'success';
  if (status === 'MAINTENANCE') return 'warning';
  return 'neutral';
}

function lineStatusLabel(status: string) {
  if (status === 'ACTIVE') return 'AKTIF';
  if (status === 'MAINTENANCE') return 'MAINTENANCE';
  return 'NONAKTIF';
}

// ─── Error Alert ──────────────────────────────────────────────────────────────

function ErrorAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
      <AlertAction><Button variant="outline" size="sm" onClick={onRetry}>Coba Lagi</Button></AlertAction>
    </Alert>
  );
}

// ─── Secret Dialog (shown once after create/rotate) ────────────────────────

function SecretDialog({
  open,
  secret,
  deviceCode,
  onClose,
}: {
  open: boolean;
  secret: string;
  deviceCode: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-warning-foreground" />
            Kredensial Perangkat
          </DialogTitle>
          <DialogDescription className="text-xs text-destructive font-medium">
            ⚠️ Salin secret ini sekarang. Kredensial tidak akan ditampilkan lagi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Perangkat: <strong>{deviceCode}</strong>
          </p>
          <div className="rounded-lg bg-foreground p-3">
            <code className="text-xs text-success break-all">{secret}</code>
          </div>
          <Button id="btn-copy-secret" variant="outline" size="sm" className="w-full" onClick={handleCopy}>
            {copied ? '✓ Tersalin!' : 'Salin Secret'}
          </Button>
        </div>
        <DialogFooter>
          <Button id="btn-close-secret-dialog" onClick={onClose} variant="default">
            Saya Sudah Menyalin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Line Form Dialog ─────────────────────────────────────────────────────────

interface LineFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  line?: LineView | null;
  onClose: () => void;
  onSuccess: () => void;
}

function LineFormDialog({ open, mode, line, onClose, onSuccess }: LineFormDialogProps) {
  const [lineCode, setLineCode] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'>('ACTIVE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && line) {
        setLineCode(line.lineCode);
        setName(line.name);
        setStatus(line.status as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE');
        setReason('');
      } else {
        setLineCode('');
        setName('');
        setStatus('ACTIVE');
        setReason('');
      }
      setError('');
    }
  }, [open, mode, line]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = mode === 'create' ? '/api/lines' : `/api/lines/${line?.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const body =
        mode === 'create'
          ? { lineCode, name }
          : { name, status, reason: reason.trim() || undefined };

      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Operasi gagal.');
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Tambah Jalur Baru' : 'Edit Jalur'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'create' && (
            <div className="space-y-1">
              <Label htmlFor="input-line-code">Kode Jalur</Label>
              <Input
                id="input-line-code"
                value={lineCode}
                onChange={(e) => setLineCode(e.target.value)}
                placeholder="LINE-01"
                maxLength={50}
                required
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="input-line-name">Nama Jalur</Label>
            <Input
              id="input-line-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jalur 1"
              maxLength={100}
              required
            />
          </div>
          {mode === 'edit' && (
            <>
              <div className="space-y-1">
                <Label htmlFor="select-line-status">Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                  <SelectTrigger id="select-line-status" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ACTIVE">AKTIF</SelectItem><SelectItem value="MAINTENANCE">MAINTENANCE</SelectItem><SelectItem value="INACTIVE">NONAKTIF</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="input-line-reason">Alasan Perubahan (Opsional)</Label>
                <Input
                  id="input-line-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Pemeliharaan berkala"
                  maxLength={255}
                />
              </div>
            </>
          )}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Batal
            </Button>
            <Button id="btn-submit-line-form" type="submit" size="sm" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'create' ? 'Tambah' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Device Form Dialog ───────────────────────────────────────────────────────

interface DeviceFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  device?: DeviceView | null;
  lines: LineView[];
  defaultLineId?: string;
  onClose: () => void;
  onSuccess: (secret?: string, deviceCode?: string) => void;
}

function DeviceFormDialog({
  open,
  mode,
  device,
  lines: lineList,
  defaultLineId,
  onClose,
  onSuccess,
}: DeviceFormDialogProps) {
  const [deviceCode, setDeviceCode] = useState('');
  const [name, setName] = useState('');
  const [lineId, setLineId] = useState('');
  const [status, setStatus] = useState<'MAINTENANCE' | 'ONLINE' | 'UNREGISTERED'>('UNREGISTERED');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && device) {
        setDeviceCode(device.deviceCode);
        setName(device.name);
        setLineId(device.lineId);
        setStatus(
          (device.storedStatus || device.status) as typeof status
        );
      } else {
        setDeviceCode('');
        setName('');
        setLineId(defaultLineId || (lineList[0]?.id ?? ''));
        setStatus('UNREGISTERED');
      }
      setError('');
    }
  }, [open, mode, device, lineList, defaultLineId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = mode === 'create' ? '/api/devices' : `/api/devices/${device?.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const body =
        mode === 'create'
          ? { deviceCode, lineId, name }
          : { name, lineId, status };

      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Operasi gagal.');
      }
      onSuccess(json.secret, json.device?.deviceCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Daftarkan Perangkat Baru' : 'Edit Perangkat'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'create' && (
            <div className="space-y-1">
              <Label htmlFor="input-device-code">Kode Perangkat</Label>
              <Input
                id="input-device-code"
                value={deviceCode}
                onChange={(e) => setDeviceCode(e.target.value)}
                placeholder="ESP32-LINE-01"
                maxLength={50}
                required
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="input-device-name">Nama Perangkat</Label>
            <Input
              id="input-device-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sensor Jalur 1"
              maxLength={100}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="select-device-line">Jalur</Label>
            <Select value={lineId} onValueChange={setLineId} required>
              <SelectTrigger id="select-device-line" className="w-full"><SelectValue placeholder="Pilih jalur" /></SelectTrigger>
              <SelectContent>
              {lineList.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.lineCode} – {l.name}
                </SelectItem>
              ))}
              </SelectContent>
            </Select>
          </div>
          {mode === 'edit' && (
            <div className="space-y-1">
            <Label htmlFor="select-device-status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
              <SelectTrigger id="select-device-status" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="MAINTENANCE">MAINTENANCE</SelectItem><SelectItem value="UNREGISTERED">UNREGISTERED</SelectItem><SelectItem value="ONLINE">ONLINE</SelectItem></SelectContent>
            </Select>
          </div>
          )}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Batal
            </Button>
            <Button id="btn-submit-device-form" type="submit" size="sm" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === 'create' ? (
                'Daftarkan'
              ) : (
                'Simpan'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Rotate Credential Dialog ────────────────────────────────────────────────

function RotateCredentialDialog({
  open,
  device,
  onClose,
  onSuccess,
}: {
  open: boolean;
  device: DeviceView | null;
  onClose: () => void;
  onSuccess: (secret: string, deviceCode: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRotate() {
    if (!device) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/devices/${device.id}/rotate-credential`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Rotasi gagal.');
      onSuccess(json.secret, device.deviceCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-warning-foreground" />
            Rotasi Kredensial
          </DialogTitle>
          <DialogDescription className="text-xs">
            Secret lama akan langsung tidak berlaku. Perangkat harus diperbarui dengan secret baru.
          </DialogDescription>
        </DialogHeader>
        {device && (
          <p className="text-xs text-muted-foreground">
            Perangkat: <strong>{device.deviceCode}</strong>
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button
            id="btn-confirm-rotate"
            variant="destructive"
            size="sm"
            disabled={loading}
            onClick={handleRotate}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rotasi Secret'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function LinesDevicesClient() {
  const [linesList, setLinesList] = useState<LineView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialogs
  const [lineFormOpen, setLineFormOpen] = useState(false);
  const [lineFormMode, setLineFormMode] = useState<'create' | 'edit'>('create');
  const [editingLine, setEditingLine] = useState<LineView | null>(null);

  const [deviceFormOpen, setDeviceFormOpen] = useState(false);
  const [deviceFormMode, setDeviceFormMode] = useState<'create' | 'edit'>('create');
  const [editingDevice, setEditingDevice] = useState<DeviceView | null>(null);
  const [deviceFormDefaultLineId, setDeviceFormDefaultLineId] = useState<string | undefined>();

  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotatingDevice, setRotatingDevice] = useState<DeviceView | null>(null);

  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [pendingSecret, setPendingSecret] = useState('');
  const [pendingDeviceCode, setPendingDeviceCode] = useState('');

  const { lastMessage } = useWebSocket();

  const fetchLines = useCallback(async () => {
    try {
      setError('');
      const res = await fetch('/api/lines');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Gagal mengambil data.');
      setLinesList(json.lines || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLines();
  }, [fetchLines]);

  useEffect(() => {
    if (!lastMessage) return;
    if (
      lastMessage.type === 'device.heartbeat_received' ||
      lastMessage.type === 'device.status_updated' ||
      lastMessage.type === 'realtime.reconnected' ||
      lastMessage.type === 'realtime.poll'
    ) {
      fetchLines();
    }
  }, [lastMessage, fetchLines]);

  function openCreateLine() {
    setLineFormMode('create');
    setEditingLine(null);
    setLineFormOpen(true);
  }

  function openEditLine(line: LineView) {
    setLineFormMode('edit');
    setEditingLine(line);
    setLineFormOpen(true);
  }

  function openCreateDevice(lineId?: string) {
    setDeviceFormMode('create');
    setEditingDevice(null);
    setDeviceFormDefaultLineId(lineId);
    setDeviceFormOpen(true);
  }

  function openEditDevice(device: DeviceView) {
    setDeviceFormMode('edit');
    setEditingDevice(device);
    setDeviceFormOpen(true);
  }

  function openRotate(device: DeviceView) {
    setRotatingDevice(device);
    setRotateOpen(true);
  }

  function handleSecretReady(secret: string, deviceCode: string) {
    setPendingSecret(secret);
    setPendingDeviceCode(deviceCode);
    setDeviceFormOpen(false);
    setRotateOpen(false);
    setSecretDialogOpen(true);
    fetchLines();
  }

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <PageHeader title="Jalur & Perangkat ESP32" description="Kelola jalur counting dan perangkat sensor secara aman." actions={<>
          <Button id="btn-add-line" size="sm" onClick={openCreateLine} className="min-h-[44px] sm:min-h-0">
            <Plus className="h-4 w-4 mr-1" />
            Tambah Jalur
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLines} title="Muat ulang" aria-label="Muat ulang data jalur" className="gap-1 min-h-[44px] sm:min-h-0">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Muat ulang
          </Button>
        </>} />

      {/* ── Error / Loading / Empty states ── */}
      {error ? (
        <ErrorAlert message={error} onRetry={fetchLines} />
      ) : loading && linesList.length === 0 ? (
        <LoadingState label="Memuat data jalur dan perangkat" rows={4} />
      ) : linesList.length === 0 ? (
        <EmptyState icon={GitBranch} title="Belum ada jalur" description="Tambahkan jalur untuk mulai menghubungkan perangkat sensor." />
      ) : (
        <div className="space-y-6">
          {linesList.map((line) => (
            <Card key={line.id} className="border-border">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <GitBranch className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <CardTitle className="text-base font-semibold">
                        {line.lineCode}{' '}
                        <span className="text-muted-foreground font-normal">— {line.name}</span>
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {line.devices.length} perangkat terdaftar
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={lineStatusVariant(line.status)}>
                      {lineStatusLabel(line.status)}
                    </StatusBadge>
                    <Button
                      id={`btn-edit-line-${line.id}`}
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs min-h-[44px] sm:min-h-0"
                      title="Edit Jalur"
                      aria-label={`Edit Jalur ${line.lineCode}`}
                      onClick={() => openEditLine(line)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </Button>
                    <Button
                      id={`btn-add-device-to-line-${line.id}`}
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs min-h-[44px] sm:min-h-0"
                      onClick={() => openCreateDevice(line.id)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Perangkat</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0 sm:p-6">
                {line.devices.length === 0 ? (
                  <div className="m-4 rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                    Belum ada perangkat pada jalur ini.
                  </div>
                ) : (
                  <>
                    {/* Mobile View (< md) */}
                    <div className="divide-y divide-border md:hidden">
                      {line.devices.map((device) => (
                        <div key={device.id} className="p-4 space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                              <Cpu className="size-4 text-primary" />
                              {device.deviceCode}
                            </span>
                            <StatusBadge tone={deviceStatusVariant(device.status)} className="gap-1">
                              <Radio className={`size-2.5 ${device.status === 'ONLINE' ? 'animate-pulse' : ''}`} />
                              {device.status}
                            </StatusBadge>
                          </div>

                          <div className="text-muted-foreground space-y-1">
                            <p><span className="font-medium text-foreground">{device.name}</span></p>
                            <p>
                              Heartbeat: {device.lastHeartbeatAt ? new Date(device.lastHeartbeatAt).toLocaleString('id-ID') : 'Belum ada'}
                            </p>
                            <p>
                              Firmware: {device.firmwareVersion || '—'} • RSSI: {device.wifiRssi != null ? `${device.wifiRssi} dBm` : '—'}
                            </p>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                            <Button
                              id={`btn-edit-device-mobile-${device.id}`}
                              variant="outline"
                              size="sm"
                              className="gap-1 text-xs min-h-[44px] sm:min-h-0"
                              onClick={() => openEditDevice(device)}
                              aria-label={`Edit Perangkat ${device.deviceCode}`}
                            >
                              <Settings className="size-3.5" />
                              <span>Pengaturan</span>
                            </Button>
                            <Button
                              id={`btn-rotate-device-mobile-${device.id}`}
                              variant="outline"
                              size="sm"
                              className="gap-1 text-xs text-warning-foreground min-h-[44px] sm:min-h-0"
                              onClick={() => openRotate(device)}
                              aria-label={`Rotasi Kredensial ${device.deviceCode}`}
                            >
                              <Key className="size-3.5" />
                              <span>Rotasi Secret</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop View (>= md) */}
                    <div className="hidden md:block rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted">
                          <TableRow>
                            <TableHead className="text-xs">Kode</TableHead>
                            <TableHead className="text-xs">Nama</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Heartbeat Terakhir</TableHead>
                            <TableHead className="text-xs">Firmware</TableHead>
                            <TableHead className="text-xs">RSSI</TableHead>
                            <TableHead className="text-xs text-right">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {line.devices.map((device) => (
                            <TableRow key={device.id}>
                              <TableCell className="font-medium text-foreground">
                                <span className="flex items-center gap-1">
                                  <Cpu className="h-3 w-3 text-primary" />
                                  {device.deviceCode}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs">{device.name}</TableCell>
                              <TableCell>
                                <StatusBadge
                                  tone={deviceStatusVariant(device.status)}
                                  className="gap-1"
                                >
                                  <Radio
                                    className={`h-2.5 w-2.5 ${device.status === 'ONLINE' ? 'animate-pulse' : ''}`}
                                  />
                                  {device.status}
                                </StatusBadge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {device.lastHeartbeatAt
                                  ? new Date(device.lastHeartbeatAt).toLocaleString('id-ID')
                                  : 'Belum ada'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {device.firmwareVersion || '—'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {device.wifiRssi != null ? `${device.wifiRssi} dBm` : '—'}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    id={`btn-edit-device-${device.id}`}
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                                    title="Edit Perangkat"
                                    aria-label={`Edit Perangkat ${device.deviceCode}`}
                                    onClick={() => openEditDevice(device)}
                                  >
                                    <Settings className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    id={`btn-rotate-device-${device.id}`}
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-warning-foreground min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                                    title="Rotasi Credential"
                                    aria-label={`Rotasi Credential Perangkat ${device.deviceCode}`}
                                    onClick={() => openRotate(device)}
                                  >
                                    <Key className="h-4 w-4" />
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
            </Card>
          ))}
        </div>
      )}

      {/* ── Dialogs ── */}
      <LineFormDialog
        open={lineFormOpen}
        mode={lineFormMode}
        line={editingLine}
        onClose={() => setLineFormOpen(false)}
        onSuccess={() => {
          setLineFormOpen(false);
          fetchLines();
        }}
      />

      <DeviceFormDialog
        open={deviceFormOpen}
        mode={deviceFormMode}
        device={editingDevice}
        lines={linesList}
        defaultLineId={deviceFormDefaultLineId}
        onClose={() => setDeviceFormOpen(false)}
        onSuccess={(secret, code) => {
          if (secret && code) {
            handleSecretReady(secret, code);
          } else {
            setDeviceFormOpen(false);
            fetchLines();
          }
        }}
      />

      <RotateCredentialDialog
        open={rotateOpen}
        device={rotatingDevice}
        onClose={() => setRotateOpen(false)}
        onSuccess={handleSecretReady}
      />

      <SecretDialog
        open={secretDialogOpen}
        secret={pendingSecret}
        deviceCode={pendingDeviceCode}
        onClose={() => setSecretDialogOpen(false)}
      />
    </div>
  );
}
