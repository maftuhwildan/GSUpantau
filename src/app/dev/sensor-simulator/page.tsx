"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { applyDeviceHealthViewUpdate } from "@/lib/device-health-view";
import {
  Radio,
  Play,
  Square,
  RefreshCw,
  Zap,
  Clock,
  Copy,
  Wifi,
  WifiOff,
  Terminal,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2,
} from "lucide-react";

interface DeviceOption {
  id: string;
  deviceCode: string;
  name: string;
  status: string;
  firmwareVersion: string;
  wifiRssi?: number | null;
  lastHeartbeatAt: string | null;
  defaultSecret: string;
}

interface LineOption {
  id: string;
  lineCode: string;
  name: string;
  status: string;
  devices: DeviceOption[];
}

interface LogEntry {
  id: string;
  timestamp: string;
  action: string;
  httpStatus: number;
  requestPayload: any;
  responsePayload: any;
  success: boolean;
}

export default function SensorSimulatorPage() {
  const [role, setRole] = useState<"OPERATOR" | "ADMIN">("ADMIN");
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<LineOption[]>([]);
  
  const [selectedLineCode, setSelectedLineCode] = useState<string>("");
  const [selectedDeviceCode, setSelectedDeviceCode] = useState<string>("");
  const [deviceSecret, setDeviceSecret] = useState<string>("");
  
  const [bootId, setBootId] = useState<string>("");
  const [sequence, setSequence] = useState<number>(0);
  const [autoDetecting, setAutoDetecting] = useState<boolean>(false);
  const [autoHeartbeat, setAutoHeartbeat] = useState<boolean>(true);
  const [heartbeatStatus, setHeartbeatStatus] = useState<"ONLINE" | "OFFLINE">("ONLINE");
  
  const [activeSessionInfo, setActiveSessionInfo] = useState<{
    id: string;
    receivingNumber: string;
    actualCount: number;
    manifestCount: number;
  } | null>(null);

  const [lastSentEvent, setLastSentEvent] = useState<{
    eventId: string;
    bootId: string;
    sequence: number;
    deviceTime: string;
  } | null>(null);

  // A boot gets its own identity, while sequence only needs to live in RAM.
  useEffect(() => {
    setBootId(crypto.randomUUID());
    setSequence(0);
  }, []);

  const [logs, setLogs] = useState<LogEntry[]>([]);

  const autoDetectIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const addLog = (
    action: string,
    httpStatus: number,
    requestPayload: any,
    responsePayload: any,
    success: boolean
  ) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString("id-ID", { hour12: false }),
      action,
      httpStatus,
      requestPayload,
      responsePayload,
      success,
    };
    setLogs((prev) => [entry, ...prev].slice(0, 100));
  };

  const fetchSimulatorOptions = useCallback(async () => {
    const response = await fetch("/api/dev/simulator/options");
    if (!response.ok) return [];

    const data = await response.json();
    const linesList: LineOption[] = data.lines || [];
    setOptions(linesList);
    return linesList;
  }, []);

  // Fetch session & simulator options on load
  useEffect(() => {
    async function init() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          if (sessionData.user) {
            setUserEmail(sessionData.user.email);
            if (sessionData.user.roles?.includes("ADMIN")) {
              setRole("ADMIN");
            } else {
              setRole("OPERATOR");
            }
          }
        }

        const linesList = await fetchSimulatorOptions();
        if (linesList.length > 0) {
          const firstLine = linesList[0];
          setSelectedLineCode(firstLine.lineCode);
          if (firstLine.devices.length > 0) {
            const firstDev = firstLine.devices[0];
            setSelectedDeviceCode(firstDev.deviceCode);
            setDeviceSecret(firstDev.defaultSecret || "secret-device-key-01");
          }
        }
      } catch (err) {
        console.error("Gagal memuat opsi simulator:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [fetchSimulatorOptions]);

  useEffect(() => {
    if (loading) return;
    const interval = setInterval(() => {
      fetchSimulatorOptions().catch((err) => {
        console.error("Gagal memperbarui status simulator:", err);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [loading, fetchSimulatorOptions]);

  // Sync selected line / device options
  const handleLineChange = (lineCode: string) => {
    setBootId(crypto.randomUUID());
    setSequence(0);
    setLastSentEvent(null);
    setSelectedLineCode(lineCode);
    const foundLine = options.find((l) => l.lineCode === lineCode);
    if (foundLine && foundLine.devices.length > 0) {
      const dev = foundLine.devices[0];
      setSelectedDeviceCode(dev.deviceCode);
      setDeviceSecret(dev.defaultSecret || "");
    } else {
      setSelectedDeviceCode("");
      setDeviceSecret("");
    }
  };

  const handleDeviceChange = (deviceCode: string) => {
    setBootId(crypto.randomUUID());
    setSequence(0);
    setLastSentEvent(null);
    setSelectedDeviceCode(deviceCode);
    const foundLine = options.find((l) => l.lineCode === selectedLineCode);
    const foundDev = foundLine?.devices.find((d) => d.deviceCode === deviceCode);
    if (foundDev) {
      setDeviceSecret(foundDev.defaultSecret || "");
    }
  };

  const selectedLineId = options.find((line) => line.lineCode === selectedLineCode)?.id;

  // Fetch active session info for line
  const fetchActiveSession = useCallback(async () => {
    if (!selectedLineId) return;
    try {
      const res = await fetch(`/api/lines/${selectedLineId}/active-session`);
      if (res.ok) {
        const data = await res.json();
        if (data.activeSession) {
          setActiveSessionInfo({
            id: data.activeSession.id,
            receivingNumber: data.activeSession.receiving?.deliveryNoteNumber || "Draft/N/A",
            actualCount: data.activeSession.actualCount || 0,
            manifestCount: data.activeSession.receiving?.manifestCount || 0,
          });
        } else {
          setActiveSessionInfo(null);
        }
      }
    } catch (err) {
      console.error("Gagal mengecek sesi aktif:", err);
    }
  }, [selectedLineId]);

  useEffect(() => {
    fetchActiveSession();
    const interval = setInterval(fetchActiveSession, 3000);
    return () => clearInterval(interval);
  }, [fetchActiveSession]);

  // Core API call: POST /api/device/events
  const sendDetections = async (
    count: number = 1,
    isDuplicate: boolean = false,
    isDelayed: boolean = false
  ) => {
    if (!selectedDeviceCode || !selectedLineCode || !bootId) return;

    let currentSeq = sequence;
    const eventsPayload = [];

    for (let i = 0; i < count; i++) {
      let eventId: string;
      let seqNum: number;
      let deviceTime: string;

      if (isDuplicate && lastSentEvent) {
        eventId = lastSentEvent.eventId;
        seqNum = lastSentEvent.sequence;
        deviceTime = lastSentEvent.deviceTime;
      } else {
        currentSeq += 1;
        seqNum = currentSeq;
        eventId = `${selectedDeviceCode}:${bootId}:${seqNum}`;
        
        if (isDelayed) {
          // Delayed by 10 minutes
          deviceTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        } else {
          deviceTime = new Date().toISOString();
        }
      }

      eventsPayload.push({
        event_id: eventId,
        boot_id: isDuplicate && lastSentEvent ? lastSentEvent.bootId : bootId,
        sequence: seqNum,
        event_type: "DETECTION" as const,
        device_time: deviceTime,
        event_mode: "PRODUCTION" as const,
      });

      if (!isDuplicate) {
        setLastSentEvent({ eventId, bootId, sequence: seqNum, deviceTime });
      }
    }

    if (!isDuplicate) {
      setSequence(currentSeq);
    }

    const body = {
      device_id: selectedDeviceCode,
      line_id: selectedLineCode,
      events: eventsPayload,
    };

    try {
      const res = await fetch("/api/device/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${deviceSecret}`,
        },
        body: JSON.stringify(body),
      });

      const resJson = await res.json();
      const actionName = isDuplicate
        ? "Event Duplikat (+0)"
        : isDelayed
        ? `Delayed Event (+${count})`
        : `Detection Event (+${count})`;

      addLog(actionName, res.status, body, resJson, res.ok);
      fetchActiveSession();
    } catch (err: any) {
      addLog("Detection Event Error", 500, body, { error: err.message }, false);
    }
  };

  // Core API call: POST /api/device/heartbeat
  const sendHeartbeat = async () => {
    if (!selectedDeviceCode || !selectedLineCode) return;

    const body = {
      device_id: selectedDeviceCode,
      line_id: selectedLineCode,
      firmware_version: "v1.2.0-sim",
      wifi_rssi: -58 - Math.floor(Math.random() * 15),
      diagnostic_payload: {
        free_heap: 120000 + Math.floor(Math.random() * 5000),
        uptime_seconds: Math.floor(performance.now() / 1000),
        simulator: true,
      },
    };

    try {
      const res = await fetch("/api/device/heartbeat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${deviceSecret}`,
        },
        body: JSON.stringify(body),
      });

      const resJson = await res.json();
      addLog("Heartbeat", res.status, body, resJson, res.ok);
      if (res.ok) {
        setOptions((currentOptions) =>
          applyDeviceHealthViewUpdate(currentOptions, {
            deviceCode: selectedDeviceCode,
            status: resJson.device_status,
            lastHeartbeatAt: resJson.last_heartbeat_at || resJson.server_time,
            firmwareVersion: resJson.firmware_version,
            wifiRssi: resJson.wifi_rssi,
          })
        );
      }
    } catch (err: any) {
      addLog("Heartbeat Error", 500, body, { error: err.message }, false);
    }
  };

  // Core API call: POST /api/device/events (DEVICE_RESTART)
  const simulateRestart = async () => {
    if (!selectedDeviceCode || !selectedLineCode) return;

    const newSeq = 0; // Simulate real hardware reset to 0
    const newBootId = crypto.randomUUID();

    // Reboot changes identity even if the restart notification cannot reach
    // the server. Future detections must still use the new boot namespace.
    setBootId(newBootId);
    setSequence(newSeq);
    setLastSentEvent(null);

    const eventId = `${selectedDeviceCode}:${newBootId}:${newSeq}`;
    const body = {
      device_id: selectedDeviceCode,
      line_id: selectedLineCode,
      events: [
        {
          event_id: eventId,
          boot_id: newBootId,
          sequence: newSeq,
          event_type: "DEVICE_RESTART",
          device_time: new Date().toISOString(),
          event_mode: "PRODUCTION",
        },
      ],
    };

    try {
      const res = await fetch("/api/device/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${deviceSecret}`,
        },
        body: JSON.stringify(body),
      });

      const resJson = await res.json();
      addLog("Perangkat Restart", res.status, body, resJson, res.ok);
    } catch (err: any) {
      addLog("Restart Error", 500, body, { error: err.message }, false);
    }
  };

  // Handle Auto Detection Timer
  useEffect(() => {
    if (autoDetecting) {
      autoDetectIntervalRef.current = setInterval(() => {
        sendDetections(1);
      }, 1500);
    } else if (autoDetectIntervalRef.current) {
      clearInterval(autoDetectIntervalRef.current);
      autoDetectIntervalRef.current = null;
    }
    return () => {
      if (autoDetectIntervalRef.current) clearInterval(autoDetectIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDetecting, selectedDeviceCode, selectedLineCode, deviceSecret, sequence]);

  // Handle Auto Heartbeat Timer
  useEffect(() => {
    if (autoHeartbeat && heartbeatStatus === "ONLINE") {
      // Immediate heartbeat then interval
      sendHeartbeat();
      heartbeatIntervalRef.current = setInterval(() => {
        sendHeartbeat();
      }, 10000);
    } else if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoHeartbeat, heartbeatStatus, selectedDeviceCode, selectedLineCode, deviceSecret]);

  if (loading) {
    return (
      <DashboardShell role={role} userEmail={userEmail}>
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      </DashboardShell>
    );
  }

  const selectedDevice = options
    .find((line) => line.lineCode === selectedLineCode)
    ?.devices.find((device) => device.deviceCode === selectedDeviceCode);

  return (
    <DashboardShell role={role} userEmail={userEmail}>
      {/* Header Page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="h-6 w-6 text-purple-600 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight">Simulator Sensor ESP32</h1>
            <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
              Dev Tools
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Simulasi perangkat keras ESP32 untuk menguji ingestion Device API dan penghitungan real-time.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Device Config & Controls */}
        <div className="lg:col-span-1 space-y-6">
          {/* Device Selection Card */}
          <Card className="border-purple-100 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Radio className="h-4 w-4 text-purple-600" />
                Target Jalur & Perangkat
              </CardTitle>
              <CardDescription className="text-xs">
                Pilih jalur dan perangkat ESP32 yang akan disimulasikan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="simulator-line">Jalur Penerimaan (Line)</Label>
                <Select value={selectedLineCode} onValueChange={handleLineChange}><SelectTrigger id="simulator-line" className="w-full"><SelectValue placeholder="Pilih jalur" /></SelectTrigger><SelectContent>
                  {options.map((line) => (
                    <SelectItem key={line.id} value={line.lineCode}>
                      {line.lineCode} - {line.name}
                    </SelectItem>
                  ))}
                </SelectContent></Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="simulator-device">Perangkat ESP32</Label>
                <Select value={selectedDeviceCode} onValueChange={handleDeviceChange}><SelectTrigger id="simulator-device" className="w-full"><SelectValue placeholder="Pilih perangkat" /></SelectTrigger><SelectContent>
                  {options
                    .find((l) => l.lineCode === selectedLineCode)
                    ?.devices.map((dev) => (
                      <SelectItem key={dev.id} value={dev.deviceCode}>
                        {dev.deviceCode} ({dev.name})
                      </SelectItem>
                    ))}
                </SelectContent></Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="simulator-secret">Secret Token Perangkat</Label>
                <Input
                  id="simulator-secret"
                  type="text"
                  value={deviceSecret}
                  onChange={(e) => setDeviceSecret(e.target.value)}
                  placeholder="Kredensial Secret"
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-slate-400">
                  Digunakan pada header HTTP <code className="bg-slate-100 px-1 py-0.5 rounded">Authorization: Bearer secret</code>
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between gap-3 text-slate-600">
                  <span>Boot ID:</span>
                  <span className="font-mono font-semibold text-slate-900 truncate" title={bootId}>
                    {bootId || "Menyiapkan..."}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Sequence Saat Ini:</span>
                  <span className="font-mono font-semibold text-slate-900">{sequence}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Status Sesi Jalur:</span>
                  {activeSessionInfo ? (
                    <Badge variant="default" className="bg-emerald-600 text-[10px]">
                      AKTIF (COUNTING)
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      TIDAK ADA SESI
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Device Status & Offline Simulation Card */}
          <Card className="border-purple-100 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                {heartbeatStatus === "ONLINE" ? (
                  <Wifi className="h-4 w-4 text-emerald-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-rose-600" />
                )}
                Status Perangkat & Heartbeat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      heartbeatStatus === "ONLINE" && autoHeartbeat
                        ? "bg-emerald-500 animate-ping"
                        : "bg-rose-500"
                    }`}
                  />
                  <span className="text-xs font-semibold">
                    {heartbeatStatus === "ONLINE" && autoHeartbeat ? "ONLINE (Active Heartbeat)" : "OFFLINE / STOPPED"}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant={heartbeatStatus === "ONLINE" ? "outline" : "default"}
                  className="text-xs h-7"
                  onClick={() => {
                    if (heartbeatStatus === "ONLINE") {
                      setHeartbeatStatus("OFFLINE");
                      setAutoHeartbeat(false);
                    } else {
                      setHeartbeatStatus("ONLINE");
                      setAutoHeartbeat(true);
                    }
                  }}
                >
                  {heartbeatStatus === "ONLINE" ? "Simulasi Offline" : "Set Online"}
                </Button>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between gap-3 text-slate-600">
                  <span>Status server:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedDevice?.status || 'UNKNOWN'}
                  </span>
                </div>
                <div className="flex justify-between gap-3 text-slate-600">
                  <span>Heartbeat terakhir:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedDevice?.lastHeartbeatAt
                      ? new Date(selectedDevice.lastHeartbeatAt).toLocaleTimeString('id-ID')
                      : 'Belum ada'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs gap-1.5"
                  onClick={sendHeartbeat}
                  disabled={!selectedDeviceCode}
                >
                  <Activity className="h-3.5 w-3.5 text-purple-600" />
                  Kirim 1 Heartbeat
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50"
                  onClick={simulateRestart}
                  disabled={!selectedDeviceCode}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restart Device
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Simulation Controls & Logs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Realtime Active Session Dashboard Bar */}
          {activeSessionInfo && (
            <div className="p-4 rounded-xl bg-linear-to-r from-purple-900 to-slate-900 text-white shadow-md flex items-center justify-between">
              <div>
                <p className="text-[11px] text-purple-200 font-medium">SESI AKTIF PADA {selectedLineCode}</p>
                <h3 className="text-lg font-bold">Surat Jalan #{activeSessionInfo.receivingNumber}</h3>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-purple-200 font-medium">DERIVED ACTUAL COUNT</p>
                <div className="text-3xl font-extrabold text-pink-400 font-mono">
                  {activeSessionInfo.actualCount}{" "}
                  <span className="text-xs font-normal text-slate-300">
                    / {activeSessionInfo.manifestCount} ekor
                  </span>
                </div>
              </div>
            </div>
          )}

          {!activeSessionInfo && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold">Tidak ada sesi counting aktif di jalur {selectedLineCode}.</span>
                <p className="text-amber-700 mt-0.5">
                  Setiap detection event yang dikirim akan disimpan dengan status <code className="bg-amber-100 px-1 py-0.5 rounded">UNASSIGNED</code>.
                </p>
              </div>
            </div>
          )}

          {/* Action Simulator Panel */}
          <Card className="border-purple-100 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-600" />
                Panel Aksi Deteksi Sensor
              </CardTitle>
              <CardDescription className="text-xs">
                Kirim event deteksi ayam (+1, +10, auto, duplikat, delayed) ke backend via Device API.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Primary Detection Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  size="lg"
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-2 shadow-xs"
                  onClick={() => sendDetections(1)}
                  disabled={!selectedDeviceCode}
                >
                  <Zap className="h-5 w-5 text-yellow-300" />
                  +1 Deteksi
                </Button>

                <Button
                  size="lg"
                  variant="secondary"
                  className="bg-purple-100 hover:bg-purple-200 text-purple-900 font-semibold gap-2"
                  onClick={() => sendDetections(10)}
                  disabled={!selectedDeviceCode}
                >
                  <Zap className="h-5 w-5 text-purple-600" />
                  +10 Deteksi (Batch)
                </Button>

                <Button
                  size="lg"
                  variant={autoDetecting ? "destructive" : "outline"}
                  className={`font-semibold gap-2 ${
                    !autoDetecting ? "border-purple-300 text-purple-700 hover:bg-purple-50" : ""
                  }`}
                  onClick={() => setAutoDetecting(!autoDetecting)}
                  disabled={!selectedDeviceCode}
                >
                  {autoDetecting ? (
                    <>
                      <Square className="h-5 w-5" />
                      Stop Auto (+1/1.5s)
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5 text-emerald-600 fill-emerald-600" />
                      Mulai Auto (+1/1.5s)
                    </>
                  )}
                </Button>
              </div>

              {/* Edge Case Simulators */}
              <div className="pt-3 border-t grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <Copy className="h-3.5 w-3.5 text-blue-600" />
                      Simulasi Event Duplikat
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      Idempotency Test
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Mengirim ulang event_id dan sequence yang persis sama dengan event terakhir.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs border-blue-200 text-blue-800 hover:bg-blue-50"
                    onClick={() => sendDetections(1, true, false)}
                    disabled={!lastSentEvent}
                  >
                    Kirim Event Duplikat (+0)
                  </Button>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                      Simulasi Delayed Event
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      Backdated Time
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Mengirim event deteksi dengan device_time 10 menit yang lalu.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs border-amber-200 text-amber-800 hover:bg-amber-50"
                    onClick={() => sendDetections(1, false, true)}
                    disabled={!selectedDeviceCode}
                  >
                    Kirim Delayed Event (+1)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Console Log Panel */}
          <Card className="border-purple-100 shadow-xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-purple-600" />
                  Console Log Respon HTTP & Event Stream
                </CardTitle>
                <CardDescription className="text-xs">
                  Riwayat komunikasi HTTP langsung antara simulator dan Device API.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-slate-500 hover:text-slate-900 gap-1"
                onClick={() => setLogs([])}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Bersihkan
              </Button>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="p-8 text-center border border-dashed rounded-lg text-slate-400 text-xs">
                  Belum ada log pengiriman. Klik salah satu tombol di atas untuk memulai simulasi.
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded-lg border text-xs font-mono transition-all ${
                        log.success
                          ? "bg-slate-950 text-slate-100 border-slate-800"
                          : "bg-rose-950 text-rose-100 border-rose-800"
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1 mb-1 border-b border-white/10 text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="text-purple-400 font-bold">[{log.timestamp}]</span>
                          <span className="font-semibold text-slate-200">{log.action}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`text-[10px] px-1.5 py-0 ${
                              log.httpStatus === 200
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            }`}
                          >
                            HTTP {log.httpStatus}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] mt-1 text-slate-300">
                        <div>
                          <span className="text-slate-400 block text-[10px]">REQUEST BODY:</span>
                          <pre className="whitespace-pre-wrap break-all bg-black/40 p-1.5 rounded text-[10px] text-emerald-400">
                            {JSON.stringify(log.requestPayload, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">RESPONSE BODY:</span>
                          <pre className="whitespace-pre-wrap break-all bg-black/40 p-1.5 rounded text-[10px] text-pink-300">
                            {JSON.stringify(log.responsePayload, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
