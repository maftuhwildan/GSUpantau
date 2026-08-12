import Link from "next/link"
import { Activity, ArrowRight, Bird, ShieldCheck, UserCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"

export default function Home() {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-linear-to-b from-primary/10 via-primary/5 to-transparent" />
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Bird /></span><div className="min-w-0"><h1 className="truncate font-heading font-semibold">GSU Pantau</h1><p className="truncate text-xs text-muted-foreground">Poultry Receiving Counter</p></div></div>
        <Button asChild variant="outline" className="h-11"><Link href="/login">Masuk</Link></Button>
      </header>

      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-12 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <StatusBadge tone="primary" className="mx-auto"><Activity className="animate-pulse" /> Sistem Penghitungan Otomatis RPA</StatusBadge>
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-5xl">Rekonsiliasi manifest dan hasil sensor yang akurat, realtime, dan transparan.</h2>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Bandingkan jumlah ayam dari Surat Jalan dengan hitungan sensor ESP32 sebelum proses pemotongan, dalam satu alur operasional yang dapat diaudit.</p>
        </div>

        <div className="mx-auto mt-10 grid w-full max-w-4xl gap-4 md:grid-cols-2">
          <Card><CardHeader><span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-success/10 text-success"><UserCheck /></span><CardTitle>Portal Operator</CardTitle><CardDescription>Mulai, pantau, dan selesaikan penghitungan truck di lapangan.</CardDescription></CardHeader><CardContent><Button asChild className="h-11 w-full"><Link href="/dashboard">Buka Dashboard Operator <ArrowRight /></Link></Button></CardContent></Card>
          <Card><CardHeader><span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck /></span><CardTitle>Portal Admin</CardTitle><CardDescription>Kelola receiving, master data, perangkat, laporan, dan audit trail.</CardDescription></CardHeader><CardContent><Button asChild variant="outline" className="h-11 w-full"><Link href="/admin/dashboard">Buka Dashboard Admin <ArrowRight /></Link></Button></CardContent></Card>
        </div>
      </main>

      <footer className="relative border-t px-4 py-5 text-center text-xs text-muted-foreground">© 2026 Poultry Receiving Counter System</footer>
    </div>
  )
}
