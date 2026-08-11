import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface KpiCardProps {
  label: string
  value: string | number
  detail?: string
  icon: LucideIcon
  tone?: "primary" | "success" | "warning" | "danger" | "info" | "neutral"
  className?: string
}

const toneClasses = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning-foreground",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  neutral: "bg-muted text-muted-foreground",
}

function KpiCard({ label, value, detail, icon: Icon, tone = "primary", className }: KpiCardProps) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardContent className="flex items-center gap-4 p-4 sm:p-5">
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", toneClasses[tone])}><Icon className="size-5" /></div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 truncate font-heading text-2xl font-semibold tabular-nums">{value}</p>
          {detail ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p> : null}
        </div>
      </CardContent>
    </Card>
  )
}

export { KpiCard }
