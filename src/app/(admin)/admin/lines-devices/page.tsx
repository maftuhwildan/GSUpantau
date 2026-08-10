"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Cpu, Radio, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWebSocket } from "@/components/layout/ws-provider";

interface DeviceView {
  id: string;
  deviceCode: string;
  name: string;
  status: string;
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

function deviceBadgeVariant(status: string) {
  if (status === "ONLINE") return "success" as const;
  if (status === "DEGRADED" || status === "MAINTENANCE") return "warning" as const;
  return "destructive" as const;
}

export default function AdminLinesDevicesPage() {
  const [lines, setLines] = useState<LineView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { lastMessage } = useWebSocket();

  const fetchLines = useCallback(async () => {
    try {
      setError("");
      const response = await fetch("/api/lines");
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || "Gagal mengambil data jalur dan perangkat");
      }
      setLines(result.lines || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data");
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
      lastMessage.type === "device.heartbeat_received" ||
      lastMessage.type === "device.status_updated" ||
      lastMessage.type === "realtime.reconnected" ||
      lastMessage.type === "realtime.poll"
    ) {
      fetchLines();
    }
  }, [lastMessage, fetchLines]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">Line & Perangkat ESP32</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Kondisi jalur dan perangkat sensor berdasarkan heartbeat aktual.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchLines} title="Perbarui status perangkat">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </span>
          <Button variant="outline" size="sm" onClick={fetchLines}>Coba Lagi</Button>
        </div>
      ) : loading && lines.length === 0 ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Memuat status perangkat...</div>
      ) : lines.length === 0 ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Belum ada jalur yang terdaftar.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {lines.map((line) => (
            <Card key={line.id} className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base font-semibold">{line.lineCode} ({line.name})</CardTitle>
                  <Badge variant={line.status === "ACTIVE" ? "success" : "warning"}>{line.status}</Badge>
                </div>
                <CardDescription className="text-xs">
                  {line.devices.length} perangkat terdaftar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {line.devices.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
                    Belum ada perangkat pada jalur ini.
                  </div>
                ) : (
                  line.devices.map((device) => (
                    <div
                      key={device.id}
                      className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex justify-between items-center gap-3">
                        <span className="font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                          <Cpu className="h-4 w-4" /> {device.deviceCode}
                        </span>
                        <Badge variant={deviceBadgeVariant(device.status)} className="text-[10px] gap-1">
                          <Radio className={`h-3 w-3 ${device.status === "ONLINE" ? "animate-pulse" : ""}`} />
                          {device.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{device.name}</p>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1">
                        <div>RSSI Wi-Fi: <strong className="text-foreground">{device.wifiRssi ?? "-"} dBm</strong></div>
                        <div>Firmware: <strong className="text-foreground">{device.firmwareVersion || "-"}</strong></div>
                        <div className="col-span-2">
                          Heartbeat terakhir:{" "}
                          <strong className="text-foreground">
                            {device.lastHeartbeatAt
                              ? new Date(device.lastHeartbeatAt).toLocaleString("id-ID")
                              : "Belum ada"}
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
