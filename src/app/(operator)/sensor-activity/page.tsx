import { Activity, Radio, CheckCircle2, AlertTriangle, Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function OperatorSensorActivityPage() {
  const events = [
    { id: "ev-1", seq: 3248, type: "DETECTION", time: "10:47:02", status: "ASSIGNED", session: "SJ-2026-0807-002" },
    { id: "ev-2", seq: 3247, type: "DETECTION", time: "10:47:01", status: "ASSIGNED", session: "SJ-2026-0807-002" },
    { id: "ev-3", seq: "-", type: "HEARTBEAT", time: "10:47:00", status: "-", session: "-" },
    { id: "ev-4", seq: 3246, type: "DETECTION", time: "10:46:58", status: "ASSIGNED", session: "SJ-2026-0807-002" },
    { id: "ev-5", seq: 3240, type: "DETECTION", time: "10:12:15", status: "UNASSIGNED", session: "Di luar sesi" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">Aktivitas Sensor ESP32 (Line 01)</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Inspeksi log deteksi sensor, sinyal heartbeat, dan status assigned/unassigned.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" className="gap-1">
            <Radio className="h-3 w-3 animate-pulse" /> ONLINE
          </Badge>
        </div>
      </div>

      {/* Sensor Info Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ID Perangkat</p>
              <p className="font-bold text-foreground text-sm">ESP32-LINE-01</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status Heartbeat</p>
              <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">OK (Setiap 10s)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Versi Firmware</p>
              <p className="font-bold text-foreground text-sm">v1.0.0-PROD</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events Stream Table */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Log Aliran Event Sensor</CardTitle>
          <CardDescription className="text-xs">
            Log mentah dari sensor ESP32 bersifat immutable dan disimpan untuk audit trail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-border">
                <tr>
                  <th className="p-3">Waktu</th>
                  <th className="p-3">Tipe Event</th>
                  <th className="p-3">Sequence</th>
                  <th className="p-3">Status Assignment</th>
                  <th className="p-3">Sesi Terkait</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{ev.time}</td>
                    <td className="p-3 font-semibold">
                      {ev.type === "DETECTION" ? (
                        <span className="text-purple-700 dark:text-purple-400">+1 DETECTION</span>
                      ) : (
                        <span className="text-slate-400">HEARTBEAT</span>
                      )}
                    </td>
                    <td className="p-3 font-mono">{ev.seq}</td>
                    <td className="p-3">
                      {ev.status === "ASSIGNED" && (
                        <Badge variant="success" className="text-[10px]">ASSIGNED</Badge>
                      )}
                      {ev.status === "UNASSIGNED" && (
                        <Badge variant="warning" className="text-[10px] gap-1">
                          <AlertTriangle className="h-3 w-3" /> UNASSIGNED
                        </Badge>
                      )}
                      {ev.status === "-" && <span className="text-slate-400">-</span>}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{ev.session}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
