"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bird, Lock, Mail, ArrowRight, Info, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@local.test");
  const [password, setPassword] = useState("password");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error?.message || "Gagal masuk. Periksa kembali email dan kata sandi Anda.");
        setLoading(false);
        return;
      }

      const roles = data.user?.roles || [];
      const redirectUrl = roles.includes("ADMIN") ? "/admin/dashboard" : "/dashboard";
      router.push(redirectUrl);
      router.refresh();
    } catch {
      setErrorMessage("Terjadi kesalahan koneksi ke server. Silakan coba lagi.");
      setLoading(false);
    }
  };

  const handleFillCredentials = (devEmail: string) => {
    setEmail(devEmail);
    setPassword("password");
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/90 border-slate-700 text-white shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto p-3 rounded-2xl bg-purple-600/30 border border-purple-400/30 w-fit">
            <Bird className="h-8 w-8 text-pink-400" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            GSU Pantau Login
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            Masuk ke Sistem Penghitung Penerimaan Ayam RPA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-700/50 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-purple-400" /> Email
              </label>
              <Input
                type="email"
                placeholder="nama@perusahaan.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-purple-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-purple-400" /> Kata Sandi
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-purple-500"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white gap-2 font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <span>Masuk Sistem</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Dev credentials box */}
          <div className="p-3.5 rounded-lg bg-purple-950/40 border border-purple-800/40 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-purple-300">
              <Info className="h-4 w-4" />
              <span>Akun Pengembang (Development Users):</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
              <button
                type="button"
                onClick={() => handleFillCredentials("operator@local.test")}
                className="p-2 rounded bg-slate-900/60 hover:bg-purple-900/40 border border-slate-800 hover:border-purple-700 text-left transition-colors cursor-pointer"
              >
                <p className="font-medium text-emerald-400">OPERATOR</p>
                <p className="text-slate-400">operator@local.test</p>
                <p className="text-[10px] text-slate-500">Klik untuk isi data</p>
              </button>
              <button
                type="button"
                onClick={() => handleFillCredentials("admin@local.test")}
                className="p-2 rounded bg-slate-900/60 hover:bg-purple-900/40 border border-slate-800 hover:border-purple-700 text-left transition-colors cursor-pointer"
              >
                <p className="font-medium text-purple-400">ADMIN</p>
                <p className="text-slate-400">admin@local.test</p>
                <p className="text-[10px] text-slate-500">Klik untuk isi data</p>
              </button>
            </div>
          </div>

          <div className="text-center text-xs text-slate-400">
            <Link href="/" className="hover:text-purple-300 underline underline-offset-4">
              Kembali ke Beranda Demo
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
