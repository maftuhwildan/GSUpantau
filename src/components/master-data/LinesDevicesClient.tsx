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
import { Input } from '@/components/ui/input';
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

function deviceStatusVariant(status: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'ONLINE') return 'success';
  if (status === 'DEGRADED' || status === 'MAINTENANCE') return 'warning';
  if (status === 'OFFLINE') return 'destructive';
  return 'secondary';
}

function lineStatusVariant(status: string): 'success' | 'warning' | 'secondary' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'MAINTENANCE') return 'warning';
  return 'secondary';
}

function lineStatusLabel(status: string) {
  if (status === 'ACTIVE') return 'AKTIF';
  if (status === 'MAINTENANCE') return 'MAINTENANCE';
  return 'NONAKTIF';
}

// ─── Error Alert ──────────────────────────────────────────────────────────────

function ErrorAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
      <span className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        {message}
      </span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Coba Lagi
      </Button>
    </div>
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
            <Key className="h-5 w-5 text-amber-500" />
            Kredensial Perangkat
          </DialogTitle>
          <DialogDescription className="text-xs text-red-600 font-medium">
            ⚠️ Salin secret ini sekarang. Kredensial tidak akan ditampilkan lagi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Perangkat: <strong>{deviceCode}</strong>
          </p>
          <div className="rounded-lg bg-slate-900 p-3">
            <code className="text-xs text-green-400 break-all">{secret}</code>
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
              <label className="text-xs font-medium">Kode Jalur</label>
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
            <label className="text-xs font-medium">Nama Jalur</label>
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
                <label className="text-xs font-medium">Status</label>
                <select
                  id="select-line-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE')}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="ACTIVE">AKTIF</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="INACTIVE">NONAKTIF</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Alasan Perubahan (Opsional)</label>
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
            <p className="text-xs text-red-600">{error}</p>
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
              <label className="text-xs font-medium">Kode Perangkat</label>
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
            <label className="text-xs font-medium">Nama Perangkat</label>
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
            <label className="text-xs font-medium">Jalur</label>
            <select
              id="select-device-line"
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {lineList.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.lineCode} – {l.name}
                </option>
              ))}
            </select>
          </div>
          {mode === 'edit' && (
            <div className="space-y-1">
            <label className="text-xs font-medium">Status</label>
            <select
              id="select-device-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="MAINTENANCE">MAINTENANCE</option>
              <option value="UNREGISTERED">UNREGISTERED</option>
              <option value="ONLINE">ONLINE</option>
            </select>
          </div>
          )}
          {error && (
            <p className="text-xs text-red-600">{error}</p>
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
            <RotateCcw className="h-5 w-5 text-amber-500" />
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
        {error && <p className="text-xs text-red-600">{error}</p>}
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">Line & Perangkat ESP32</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Kelola jalur counting dan perangkat sensor secara aman.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button id="btn-add-line" size="sm" onClick={openCreateLine}>
            <Plus className="h-4 w-4 mr-1" />
            Tambah Jalur
          </Button>
          <Button variant="outline" size="icon" onClick={fetchLines} title="Perbarui">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── Error / Loading / Empty states ── */}
      {error ? (
        <ErrorAlert message={error} onRetry={fetchLines} />
      ) : loading && linesList.length === 0 ? (
        <div className="p-12 text-center text-sm text-muted-foreground">
          Memuat data jalur dan perangkat...
        </div>
      ) : linesList.length === 0 ? (
        <div className="p-12 text-center text-sm text-muted-foreground">
          Belum ada jalur yang terdaftar.
        </div>
      ) : (
        <div className="space-y-6">
          {linesList.map((line) => (
            <Card key={line.id} className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <GitBranch className="h-4 w-4 text-purple-600" />
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
                  <div className="flex items-center gap-2">
                    <Badge variant={lineStatusVariant(line.status)} className="text-[10px]">
                      {lineStatusLabel(line.status)}
                    </Badge>
                    <Button
                      id={`btn-edit-line-${line.id}`}
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Edit jalur"
                      onClick={() => openEditLine(line)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      id={`btn-add-device-to-line-${line.id}`}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => openCreateDevice(line.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Perangkat
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {line.devices.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                    Belum ada perangkat pada jalur ini.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
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
                          <TableCell className="text-xs font-mono font-semibold text-purple-700 dark:text-purple-400">
                            <span className="flex items-center gap-1">
                              <Cpu className="h-3 w-3" />
                              {device.deviceCode}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">{device.name}</TableCell>
                          <TableCell>
                            <Badge
                              variant={deviceStatusVariant(device.status)}
                              className="text-[10px] gap-1"
                            >
                              <Radio
                                className={`h-2.5 w-2.5 ${device.status === 'ONLINE' ? 'animate-pulse' : ''}`}
                              />
                              {device.status}
                            </Badge>
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
                                className="h-6 w-6"
                                title="Edit perangkat"
                                onClick={() => openEditDevice(device)}
                              >
                                <Settings className="h-3 w-3" />
                              </Button>
                              <Button
                                id={`btn-rotate-device-${device.id}`}
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-amber-600 hover:text-amber-700"
                                title="Rotasi credential"
                                onClick={() => openRotate(device)}
                              >
                                <Key className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
