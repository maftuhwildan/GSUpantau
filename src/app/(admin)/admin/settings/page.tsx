"use client";

import { useEffect, useState } from "react";
import { Settings, Save, Globe, Clock, ShieldAlert, Cpu, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingState } from "@/components/ui/states";

export default function AdminSettingsPage() {
  const [siteName, setSiteName] = useState("Poultry Receiving Counter System - RPA Jaya Abadi");
  const [siteTimezone, setSiteTimezone] = useState("Asia/Jakarta");
  const [heartbeatDegradedThresholdSeconds, setHeartbeatDegradedThresholdSeconds] = useState(15);
  const [heartbeatOfflineThresholdSeconds, setHeartbeatOfflineThresholdSeconds] = useState(30);
  const [pollingFallbackIntervalSeconds, setPollingFallbackIntervalSeconds] = useState(5);
  const [deviceBatchSize, setDeviceBatchSize] = useState(100);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        setSiteName(s.siteName ?? "Poultry Receiving Counter System - RPA Jaya Abadi");
        setSiteTimezone(s.siteTimezone ?? "Asia/Jakarta");
        setHeartbeatDegradedThresholdSeconds(s.heartbeatDegradedThresholdSeconds ?? 15);
        setHeartbeatOfflineThresholdSeconds(s.heartbeatOfflineThresholdSeconds ?? 30);
        setPollingFallbackIntervalSeconds(s.pollingFallbackIntervalSeconds ?? 5);
        setDeviceBatchSize(s.deviceBatchSize ?? 100);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (heartbeatDegradedThresholdSeconds >= heartbeatOfflineThresholdSeconds) {
      setError("Threshold Degraded (peringatan) harus lebih kecil dari Threshold Offline.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName,
          siteTimezone,
          heartbeatDegradedThresholdSeconds: Number(heartbeatDegradedThresholdSeconds),
          heartbeatOfflineThresholdSeconds: Number(heartbeatOfflineThresholdSeconds),
          pollingFallbackIntervalSeconds: Number(pollingFallbackIntervalSeconds),
          deviceBatchSize: Number(deviceBatchSize),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Gagal menyimpan perubahan pengaturan.");
      }

      setSuccessMessage("Pengaturan sistem berhasil diperbarui dan diterapkan!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengaturan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-background dark:bg-card p-6 rounded-xl border border-border shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-foreground">Pengaturan Sistem (Site Settings)</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Konfigurasi lokasi RPA, zona waktu default, interval fallback, dan batas ambang status sensor.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchSettings}
              className="text-xs gap-1"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Reset / Refresh</span>
            </Button>
            <Button
              type="submit"
              disabled={submitting || loading}
              className="bg-primary hover:bg-primary text-primary-foreground text-xs gap-1.5"
            >
              <Save className="h-4 w-4" />
              <span>{submitting ? "Menyimpan..." : "Simpan Perubahan"}</span>
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <LoadingState label="Memuat pengaturan sistem" rows={4} />
        ) : (
          <>
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
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
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-timezone" className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-primary" /> Site Timezone
                    </Label>
                    <Input
                      id="settings-timezone"
                      value={siteTimezone}
                      onChange={(e) => setSiteTimezone(e.target.value)}
                      required
                      className="text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">Default MVP: Asia/Jakarta (WIB)</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="settings-polling">Interval Fallback Polling (Detik)</Label>
                    <Input
                      id="settings-polling"
                      type="number"
                      value={pollingFallbackIntervalSeconds}
                      onChange={(e) => setPollingFallbackIntervalSeconds(Number(e.target.value))}
                      required
                      min={1}
                      className="text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">Interval refresh cadangan saat WebSocket terputus</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
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
                      value={heartbeatDegradedThresholdSeconds}
                      onChange={(e) => setHeartbeatDegradedThresholdSeconds(Number(e.target.value))}
                      required
                      min={1}
                      className="text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Detik tanpa heartbeat sebelum sensor ditandai Peringatan (Degraded)
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="settings-offline">Threshold Heartbeat Offline (Detik)</Label>
                    <Input
                      id="settings-offline"
                      type="number"
                      value={heartbeatOfflineThresholdSeconds}
                      onChange={(e) => setHeartbeatOfflineThresholdSeconds(Number(e.target.value))}
                      required
                      min={1}
                      className="text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
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
                    value={deviceBatchSize}
                    onChange={(e) => setDeviceBatchSize(Number(e.target.value))}
                    required
                    min={1}
                    max={100}
                    className="text-xs font-mono max-w-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Jumlah maksimum event per unggahan batch dari perangkat ESP32 (Maksimal 100)
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </form>
    </div>
  );
}
