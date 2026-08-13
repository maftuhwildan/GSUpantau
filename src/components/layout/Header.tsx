"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ChevronRight, LogOut, Radio, ShieldCheck, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge"
import { getNavigationBreadcrumb, type AppRole } from "./navigation"
import { useWebSocket } from "./ws-provider"

interface HeaderDevice {
  status: string
}

interface HeaderLine {
  lineCode: string
  devices: HeaderDevice[]
}

interface HeaderProps {
  userEmail?: string
  role?: AppRole
}

export function Header({ userEmail = "user@local.test", role = "OPERATOR" }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { lastMessage } = useWebSocket()
  const [lines, setLines] = useState<HeaderLine[]>([])
  const [healthLoaded, setHealthLoaded] = useState(false)
  const breadcrumb = getNavigationBreadcrumb(pathname, role)

  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch("/api/lines")
      if (!response.ok) return
      const result = await response.json()
      setLines(result.lines || [])
    } catch {
      // Detail gangguan tetap tersedia pada halaman kesehatan perangkat.
    } finally {
      setHealthLoaded(true)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  useEffect(() => {
    if (!lastMessage) return
    if (["device.heartbeat_received", "device.status_updated", "realtime.reconnected", "realtime.poll"].includes(lastMessage.type)) {
      fetchHealth()
    }
  }, [lastMessage, fetchHealth])

  const systemHealth = useMemo(() => {
    const allDevices = lines.flatMap((line) => line.devices || [])
    if (!healthLoaded) return { status: "LOADING", label: "Memeriksa perangkat" }
    if (allDevices.length === 0) return { status: "UNREGISTERED", label: "Belum ada perangkat" }

    const statuses = allDevices.map((device) => device.status)
    const status = statuses.includes("OFFLINE")
      ? "OFFLINE"
      : statuses.includes("UNREGISTERED")
        ? "UNREGISTERED"
        : statuses.includes("DEGRADED")
          ? "DEGRADED"
          : statuses.includes("MAINTENANCE")
            ? "MAINTENANCE"
            : "ONLINE"

    if (role === "OPERATOR" && lines[0]) return { status, label: `${lines[0].lineCode} • ${status}` }

    const onlineCount = statuses.filter((deviceStatus) => deviceStatus === "ONLINE").length
    return { status, label: `${onlineCount}/${allDevices.length} online` }
  }, [healthLoaded, lines, role])

  const healthTone: StatusTone = systemHealth.status === "ONLINE"
    ? "success"
    : systemHealth.status === "DEGRADED" || systemHealth.status === "MAINTENANCE"
      ? "warning"
      : systemHealth.status === "LOADING"
        ? "neutral"
        : "danger"

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      router.push("/login")
      router.refresh()
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur-sm sm:h-16 sm:px-5">
      <SidebarTrigger className="size-10 sm:size-9" />
      <div className="h-5 w-px bg-border" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-heading text-sm font-medium sm:hidden">
          {breadcrumb.title}
        </h1>
        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
          {breadcrumb.groupLabel ? (
            <>
              <span className="truncate text-muted-foreground">{breadcrumb.groupLabel}</span>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </>
          ) : null}
          <span className="truncate font-heading font-medium text-foreground" aria-current="page">
            {breadcrumb.title}
          </span>
        </nav>
      </div>

      <StatusBadge tone={healthTone} className="max-w-40 shrink-0 sm:max-w-none">
        <Radio className={systemHealth.status === "ONLINE" ? "animate-pulse" : ""} />
        <span className="truncate">{systemHealth.label}</span>
      </StatusBadge>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-lg" aria-label="Buka menu pengguna">
            <User />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="space-y-1">
            <span className="block truncate font-medium">{userEmail}</span>
            <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <ShieldCheck className="size-3.5" /> {role}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
            <LogOut /> Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
