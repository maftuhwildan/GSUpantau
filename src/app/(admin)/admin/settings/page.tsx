"use client";

import { useEffect, useState, useMemo } from "react";
import { Settings, Save, Globe, Clock, ShieldAlert, Cpu, RefreshCw, CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface SystemSettingsState {
  siteName: string;
  siteTimezone: string;
  heartbeatDegradedThresholdSeconds: number;
  heartbeatOfflineThresholdSeconds: number;
  pollingFallbackIntervalSeconds: number;
  deviceBatchSize: number;
}

const DEFAULT_SETTINGS: SystemSettingsState = {
  siteName: "Poultry Receiving Counter System - RPA Jaya Abadi",
  siteTimezone: "Asia/Jakarta",
  heartbeatDegradedThresholdSeconds: 15,
  heartbeatOfflineThresholdSeconds: 30,
  pollingFallbackIntervalSeconds: 5,
  deviceBatchSize: 100,
};

export default function AdminSettingsPage() {
  const [initialSnapshot, setInitialSnapshot] = useState<SystemSettingsState>(DEFAULT_SETTINGS);
  const [formState, setFormState] = useState<SystemSettingsState>(DEFAULT_SETTINGS);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/settings");
      if (!res.ok) {
        throw new Error("Gagal mengambil pengaturan sistem.");
      }
      const data = await res.json();
      const s = data.settings;
      if (s) {
        const snapshot: SystemSettingsState = {
          siteName: s.siteName ?? DEFAULT_SETTINGS.siteName,
          siteTimezone: s.siteTimezone ?? DEFAULT_SETTINGS.siteTimezone,
          heartbeatDegradedThresholdSeconds: s.heartbeatDegradedThresholdSeconds ?? 15,
          heartbeatOfflineThresholdSeconds: s.heartbeatOfflineThresholdSeconds ?? 30,
          pollingFallbackIntervalSeconds: s.pollingFallbackIntervalSeconds ?? 5,
          deviceBatchSize: s.deviceBatchSize ?? 100,
        };
        setInitialSnapshot(snapshot);
        setFormState(snapshot);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const isDirty = useMemo(() => {
    return JSON.stringify(formState) !== JSON.stringify(initialSnapshot);
  }, [formState, initialSnapshot]);

  const handleFieldChange = (key: keyof SystemSettingsState, value: string | number) => {
    setFormState((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleDiscardChanges = () => {
    setFormState(initialSnapshot);
    setDiscardDialogOpen(false);
    setError(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (formState.heartbeatDegradedThresholdSeconds >= formState.heartbeatOfflineThresholdSeconds) {
      setError("Threshold Degraded (peringatan) harus lebih kecil dari Threshold Offline.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName: formState.siteName,
          siteTimezone: formState.siteTimezone,
          heartbeatDegradedThresholdSeconds: Number(formState.heartbeatDegradedThresholdSeconds),
          heartbeatOfflineThresholdSeconds: Number(formState.heartbeatOfflineThresholdSeconds),
          pollingFallbackIntervalSeconds: Number(formState.pollingFallbackIntervalSeconds),
          deviceBatchSize: Number(formState.deviceBatchSize),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Gagal menyimpan perubahan pengaturan.");
      }

      setInitialSnapshot(formState);
      setSuccessMessage("Pengaturan sistem berhasil diperbarui dan diterapkan!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengaturan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-24 md:pb-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <PageHeader
          title="Pengaturan Sistem"
          description="Konfigurasi lokasi RPA, zona waktu, interval fallback, dan ambang status sensor."
          actions={<>
            {isDirty ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDiscardDialogOpen(true)}
                disabled={submitting}
                className="gap-1 text-destructive hover:text-destructive min-h-[44px] sm:min-h-0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Batalkan Perubahan</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchSettings}
                disabled={loading || submitting}
                className="gap-1 min-h-[44px] sm:min-h-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'motion-safe:animate-spin' : ''}`} />
                <span>Muat ulang</span>
              </Button>
            )}
            <Button
              type="submit"
              disabled={!isDirty || submitting || loading}
              className="gap-1 min-h-[44px] sm:min-h-0"
            >
              <Save className="h-4 w-4" />
              <span>{submitting ? "Menyimpan..." : "Simpan Perubahan"}</span>
            </Button>
          </>}
        />

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <LoadingState label="Memuat pengaturan sistem" rows={4} />
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Globe className="h-4 w-4 text-primary" />
                  <span>Pengaturan Umum Site</span>
                </CardTitle>
                <CardDescription className="text-xs">Parameter operasional utama RPA</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <Label htmlFor="settings-site-name">Nama Sistem / RPA Site</Label>
                  <Input
                    id="settings-site-name"
                    value={formState.siteName}
                    onChange={(e) => handleFieldChange("siteName", e.target.value)}
                    required
                    className="text-xs min-h-[44px] sm:min-h-0"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-timezone" className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-primary" /> Site Timezone
                    </Label>
                    <Input
                      id="settings-timezone"
                      value={formState.siteTimezone}
                      onChange={(e) => handleFieldChange("siteTimezone", e.target.value)}
                      required
                      className="text-xs min-h-[44px] sm:min-h-0"
                    />
                    <p className="text-xs text-muted-foreground">Default MVP: Asia/Jakarta (WIB)</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="settings-polling">Interval Fallback Polling (Detik)</Label>
                    <Input
                      id="settings-polling"
                      type="number"
                      value={formState.pollingFallbackIntervalSeconds}
                      onChange={(e) => handleFieldChange("pollingFallbackIntervalSeconds", Number(e.target.value))}
                      required
                      min={1}
                      className="text-xs min-h-[44px] sm:min-h-0"
                    />
                    <p className="text-xs text-muted-foreground">Interval refresh cadangan saat WebSocket terputus</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  <span>Threshold Sinyal Sensor ESP32</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Batas ambang waktu tanpa sinyal (heartbeat) untuk status kesehatan perangkat.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-degraded">Threshold Heartbeat Degraded (Detik)</Label>
                    <Input
                      id="settings-degraded"
                      type="number"
                      value={formState.heartbeatDegradedThresholdSeconds}
                      onChange={(e) => handleFieldChange("heartbeatDegradedThresholdSeconds", Number(e.target.value))}
                      required
                      min={1}
                      className="text-xs min-h-[44px] sm:min-h-0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Detik tanpa heartbeat sebelum sensor ditandai Peringatan (Degraded)
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="settings-offline">Threshold Heartbeat Offline (Detik)</Label>
                    <Input
                      id="settings-offline"
                      type="number"
                      value={formState.heartbeatOfflineThresholdSeconds}
                      onChange={(e) => handleFieldChange("heartbeatOfflineThresholdSeconds", Number(e.target.value))}
                      required
                      min={1}
                      className="text-xs min-h-[44px] sm:min-h-0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Detik tanpa heartbeat sebelum sensor ditandai Terputus (Offline)
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-border space-y-1.5">
                  <Label htmlFor="settings-batch-size" className="flex items-center gap-1">
                    <Cpu className="h-3.5 w-3.5 text-primary" />
                    <span>Device Batch Upload Max Events</span>
                  </Label>
                  <Input
                    id="settings-batch-size"
                    type="number"
                    value={formState.deviceBatchSize}
                    onChange={(e) => handleFieldChange("deviceBatchSize", Number(e.target.value))}
                    required
                    min={1}
                    max={100}
                    className="text-xs max-w-xs min-h-[44px] sm:min-h-0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Jumlah maksimum sensor events yang dapat diupload oleh ESP32 dalam 1 payload HTTP batch.
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border z-30 flex items-center justify-between gap-3 md:hidden shadow-lg">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDiscardDialogOpen(true)}
            disabled={!isDirty || submitting}
            className="flex-1 min-h-[44px]"
          >
            Batalkan
          </Button>
          <Button
            type="submit"
            disabled={!isDirty || submitting || loading}
            className="flex-1 gap-1 min-h-[44px]"
          >
            <Save className="h-4 w-4" />
            <span>{submitting ? "Menyimpan..." : "Simpan"}</span>
          </Button>
        </div>
      </form>

      <Dialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" />
              <span>Batalkan Perubahan?</span>
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Semua perubahan pengaturan yang belum disimpan akan dikembalikan ke data awal dari server.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDiscardDialogOpen(false)}
              className="min-h-[44px] sm:min-h-0"
            >
              Kembali Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDiscardChanges}
              className="min-h-[44px] sm:min-h-0"
            >
              Ya, Batalkan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
