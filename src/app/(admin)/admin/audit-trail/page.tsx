import { History, ShieldCheck, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminAuditTrailPage() {
  const auditLogs = [
    { id: "aud-1", actor: "admin@local.test", role: "ADMIN", action: "PUBLISH_RECEIVING", entity: "Receiving", entityId: "SJ-2026-0807-003", reason: "Data lengkap dari pos depan", time: "07 Aug 10:14:22" },
    { id: "aud-2", actor: "operator@local.test", role: "OPERATOR", action: "START_SESSION", entity: "ReceivingSession", entityId: "SES-2026-002", reason: "Mulai hitung Truck B 9284 UYX", time: "07 Aug 10:15:00" },
    { id: "aud-3", actor: "admin@local.test", role: "ADMIN", action: "CREATE_RECEIVING", entity: "Receiving", entityId: "SJ-2026-0807-004", reason: "Input manual dari surat jalan fisik", time: "07 Aug 09:50:11" },
    { id: "aud-4", actor: "admin@local.test", role: "ADMIN", action: "LOGIN", entity: "UserSession", entityId: "usr-2", reason: "Sesi login berhasil", time: "07 Aug 09:45:00" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">Audit Trail Log</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Rekam jejak aktivitas penting sistem secara immutable untuk kepatuhan dan audit internal.
          </p>
        </div>
        <Badge variant="outline" className="text-purple-700 bg-purple-50">
          Append-Only Log
        </Badge>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Riwayat Aktivitas Sistem</CardTitle>
          <CardDescription className="text-xs">
            Menampilkan aktor, peran, jenis tindakan, entitas yang diubah, serta alasan revisi/tindakan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 font-semibold border-b border-border">
                <tr>
                  <th className="p-3">Waktu (UTC+7)</th>
                  <th className="p-3">Aktor & Peran</th>
                  <th className="p-3">Tindakan (Action)</th>
                  <th className="p-3">Entitas Terkait</th>
                  <th className="p-3">Alasan / Catatan Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="p-3 font-mono text-slate-500">{log.time}</td>
                    <td className="p-3">
                      <div className="font-semibold text-foreground">{log.actor}</div>
                      <span className="text-[10px] text-purple-600 font-bold">{log.role}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-purple-700 dark:text-purple-400">{log.action}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-medium text-foreground">{log.entity}</span>
                      <div className="text-[10px] text-slate-400">ID: {log.entityId}</div>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{log.reason}</td>
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
