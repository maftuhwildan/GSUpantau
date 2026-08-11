"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowRight, Bird, Info, Loader2, Lock, Mail } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("admin@local.test")
  const [password, setPassword] = useState("password")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setErrorMessage(null)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()

      if (!response.ok) {
        setErrorMessage(data.error?.message || "Gagal masuk. Periksa kembali email dan kata sandi Anda.")
        return
      }

      router.push(data.user?.roles?.includes("ADMIN") ? "/admin/dashboard" : "/dashboard")
      router.refresh()
    } catch {
      setErrorMessage("Terjadi kesalahan koneksi ke server. Silakan coba lagi.")
    } finally {
      setLoading(false)
    }
  }

  const fillCredentials = (developmentEmail: string) => {
    setEmail(developmentEmail)
    setPassword("password")
    setErrorMessage(null)
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-muted/30 p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-linear-to-b from-primary/10 to-transparent" />
      <Card className="relative w-full max-w-md shadow-xl">
        <CardHeader className="space-y-2 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20"><Bird className="size-7" /></span>
          <CardTitle className="font-heading text-2xl">Masuk ke GSU Pantau</CardTitle>
          <CardDescription>Sistem Penghitung Penerimaan Ayam RPA</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {errorMessage ? <Alert variant="destructive"><AlertCircle /><AlertDescription>{errorMessage}</AlertDescription></Alert> : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1.5"><Mail /> Email</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="nama@perusahaan.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-1.5"><Lock /> Kata Sandi</Label>
              <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <Button type="submit" disabled={loading} className="h-11 w-full gap-2">
              {loading ? <><Loader2 className="animate-spin" /> Memproses...</> : <>Masuk Sistem <ArrowRight /></>}
            </Button>
          </form>

          <div className="space-y-2 rounded-xl border bg-muted/40 p-3.5 text-xs">
            <p className="flex items-center gap-1.5 font-semibold"><Info /> Akun development</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={() => fillCredentials("operator@local.test")} className="h-auto min-h-14 justify-start p-3 text-left"><span><span className="block font-medium text-success">OPERATOR</span><span className="block text-xs text-muted-foreground">operator@local.test</span></span></Button>
              <Button type="button" variant="outline" onClick={() => fillCredentials("admin@local.test")} className="h-auto min-h-14 justify-start p-3 text-left"><span><span className="block font-medium text-primary">ADMIN</span><span className="block text-xs text-muted-foreground">admin@local.test</span></span></Button>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground"><Link href="/" className="underline underline-offset-4 hover:text-primary">Kembali ke Beranda</Link></p>
        </CardContent>
      </Card>
    </main>
  )
}
