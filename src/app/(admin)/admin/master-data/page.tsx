import { Database, Truck, UserCheck, Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminMasterDataPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">Kelola Master Data</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manajemen acuan data Truck, Supir, dan Supplier/Farm. Receiving menyimpan snapshot agar data historis terlindungi.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Trucks Master */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4 text-purple-600" />
                <span>Master Truck</span>
              </CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1">
                <Plus className="h-3 w-3" /> Tambah
              </Button>
            </div>
            <CardDescription className="text-xs">Daftar armada penerimaan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {["B 9001 AAA", "B 9284 UYX", "B 9812 KLL", "B 9102 POP"].map((plate, i) => (
              <div key={i} className="flex justify-between items-center p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-purple-700 dark:text-purple-400">{plate}</span>
                <Badge variant="success" className="text-[9px]">AKTIF</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Drivers Master */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-purple-600" />
                <span>Master Supir</span>
              </CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1">
                <Plus className="h-3 w-3" /> Tambah
              </Button>
            </div>
            <CardDescription className="text-xs">Daftar pengemudi terdaftar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {["Eko Prasetyo", "Ahmad Supardi", "Budi Santoso", "Dedi Kurniawan"].map((driver, i) => (
              <div key={i} className="flex justify-between items-center p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="font-medium text-foreground">{driver}</span>
                <Badge variant="success" className="text-[9px]">AKTIF</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Suppliers Master */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-600" />
                <span>Master Supplier / Farm</span>
              </CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1">
                <Plus className="h-3 w-3" /> Tambah
              </Button>
            </div>
            <CardDescription className="text-xs">Daftar mitra peternakan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {["Farm Poultry Prima", "Farm Maju Bersama", "Farm Berkah Jaya", "Farm Sumber Ayam"].map((supp, i) => (
              <div key={i} className="flex justify-between items-center p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="font-medium text-foreground">{supp}</span>
                <Badge variant="success" className="text-[9px]">AKTIF</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
