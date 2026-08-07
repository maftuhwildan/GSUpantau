"use client";

import { useRouter } from "next/navigation";
import { User, LogOut, ShieldCheck, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  userEmail?: string;
  role?: "OPERATOR" | "ADMIN";
}

export function Header({
  userEmail = "user@local.test",
  role = "OPERATOR",
}: HeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore errors on logout
    }
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="h-16 border-b border-border bg-white dark:bg-card px-6 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      {/* System Status / Line Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-medium border border-emerald-200 dark:border-emerald-800">
          <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-600 dark:text-emerald-400" />
          <span>Sistem Siap • Line 01 Online</span>
        </div>
      </div>

      {/* User Info & Actions */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
          <User className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-foreground">{userEmail}</span>
          <span className="text-slate-400">|</span>
          <span className="font-semibold text-primary flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            {role}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="text-xs gap-1.5 cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Keluar</span>
        </Button>
      </div>
    </header>
  );
}
