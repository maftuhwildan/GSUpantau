"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { User, LogOut, ShieldCheck, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWebSocket } from "./ws-provider";

interface HeaderDevice {
  status: string;
}

interface HeaderLine {
  lineCode: string;
  devices: HeaderDevice[];
}

interface HeaderProps {
  userEmail?: string;
  role?: "OPERATOR" | "ADMIN";
}

export function Header({
  userEmail = "user@local.test",
  role = "OPERATOR",
}: HeaderProps) {
  const router = useRouter();
  const { lastMessage } = useWebSocket();
  const [lines, setLines] = useState<HeaderLine[]>([]);
  const [healthLoaded, setHealthLoaded] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch("/api/lines");
      if (!response.ok) return;
      const result = await response.json();
      setLines(result.lines || []);
    } catch {
      // Detailed errors remain available on the page-level health views.
    } finally {
      setHealthLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  useEffect(() => {
    if (!lastMessage) return;
    if (
      lastMessage.type === "device.heartbeat_received" ||
      lastMessage.type === "device.status_updated" ||
      lastMessage.type === "realtime.reconnected" ||
      lastMessage.type === "realtime.poll"
    ) {
      fetchHealth();
    }
  }, [lastMessage, fetchHealth]);

  const systemHealth = useMemo(() => {
    const allDevices = lines.flatMap((line) => line.devices || []);
    if (!healthLoaded) return { status: "LOADING", label: "Memeriksa perangkat" };
    if (allDevices.length === 0) {
      return { status: "UNREGISTERED", label: "Belum ada perangkat" };
    }

    const statuses = allDevices.map((device) => device.status);
    const status = statuses.includes("OFFLINE")
      ? "OFFLINE"
      : statuses.includes("UNREGISTERED")
      ? "UNREGISTERED"
      : statuses.includes("DEGRADED")
      ? "DEGRADED"
      : statuses.includes("MAINTENANCE")
      ? "MAINTENANCE"
      : "ONLINE";

    if (role === "OPERATOR" && lines[0]) {
      return { status, label: `${lines[0].lineCode} • ${status}` };
    }

    const onlineCount = statuses.filter((deviceStatus) => deviceStatus === "ONLINE").length;
    return { status, label: `${onlineCount}/${allDevices.length} perangkat online` };
  }, [healthLoaded, lines, role]);

  const healthClass =
    systemHealth.status === "ONLINE"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
      : systemHealth.status === "DEGRADED" || systemHealth.status === "MAINTENANCE"
      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
      : systemHealth.status === "LOADING"
      ? "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700"
      : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800";

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
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${healthClass}`}>
          <Radio className={`h-3.5 w-3.5 ${systemHealth.status === "ONLINE" ? "animate-pulse" : ""}`} />
          <span>{systemHealth.label}</span>
        </div>
      </div>

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
