import Link from "next/link";
import { Bird, ShieldCheck, UserCheck, ArrowRight, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-6 md:p-12 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header */}
      <header className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-600/30 border border-purple-400/30 backdrop-blur-md">
            <Bird className="h-7 w-7 text-pink-400" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-wide text-white">GSU Pantau</h1>
            <p className="text-xs text-purple-300/80">Poultry Receiving Counter System</p>
          </div>
        </div>
        <Button variant="outline" asChild className="border-purple-400/40 text-purple-200 hover:bg-purple-900/50">
          <Link href="/login">Masuk Sistem</Link>
        </Button>
      </header>

      {/* Hero Body */}
      <main className="max-w-4xl mx-auto my-auto py-12 z-10 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-900/60 border border-purple-500/40 text-xs font-medium text-purple-200">
          <Activity className="h-3.5 w-3.5 text-pink-400 animate-pulse" />
          <span>Sistem Penghitungan Ayam Otomatis RPA</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Rekonsiliasi Manifest & Hasil Hitung Sensor <br />
          <span className="bg-gradient-to-r from-pink-400 via-purple-300 to-orange-400 bg-clip-text text-transparent">
            Akurat, Realtime, dan Transparan
          </span>
        </h2>
        <p className="text-slate-300 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
          Membandingkan jumlah ekor ayam dari Surat Jalan (Manifest) dengan hitungan sensor ESP32 secara akurat sebelum proses pemotongan.
        </p>

        {/* Quick Portal Switch */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left pt-6">
          <Card className="bg-slate-800/80 border-slate-700 text-white hover:border-emerald-500/50 transition-all shadow-xl">
            <CardHeader>
              <div className="p-2 w-fit rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-2">
                <UserCheck className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Portal Operator</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Akses khusus Operator lapangan untuk memulai, memantau, dan menyelesaikan penghitungan truck.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
                <Link href="/dashboard">
                  <span>Buka Dashboard Operator</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/80 border-slate-700 text-white hover:border-purple-500/50 transition-all shadow-xl">
            <CardHeader>
              <div className="p-2 w-fit rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 mb-2">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Portal Admin</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Manajemen Surat Jalan, Master Data, Line & Perangkat ESP32, Laporan, dan Audit Trail.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-purple-600 hover:bg-purple-500 text-white gap-2">
                <Link href="/admin/dashboard">
                  <span>Buka Dashboard Admin</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 z-10 border-t border-slate-800 pt-4">
        © 2026 Poultry Receiving Counter System • Batch 1 UI Scaffold
      </footer>
    </div>
  );
}
