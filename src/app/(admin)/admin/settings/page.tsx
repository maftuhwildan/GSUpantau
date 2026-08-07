import { Settings, Save, Globe, Clock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pengaturan Sistem (Site Settings)</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Konfigurasi lokasi RPA, zona waktu default, dan batas ambang heartbeat sensor.
          </p>
        </div>
        <Button className="bg-purple-600 hover:bg-purple-500 text-white text-xs gap-1.5">
          <Save className="h-4 w-4" />
          <span>Simpan Perubahan</span>
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4 text-purple-600" />
            <span>Pengaturan Umum Site</span>
          </CardTitle>
          <CardDescription className="text-xs">Parameter operasional utama RPA</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Nama Sistem / RPA Site</label>
            <Input defaultValue="Poultry Receiving Counter System - RPA Jaya Abadi" className="text-xs" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-purple-600" /> Site Timezone
              </label>
              <Input defaultValue="Asia/Jakarta" disabled className="bg-slate-100 dark:bg-slate-800 text-xs font-mono" />
              <p className="text-[10px] text-muted-foreground">Default MVP: WIB (UTC+7)</p>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Threshold Heartbeat Offline (Detik)</label>
              <Input type="number" defaultValue="30" className="text-xs" />
              <p className="text-[10px] text-muted-foreground">Detik tanpa sinyal sebelum sensor ditandai Offline</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
