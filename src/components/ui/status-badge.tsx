import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "primary"

const toneClasses: Record<StatusTone, string> = {
  success: "border-success/20 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning-foreground",
  danger: "border-destructive/20 bg-destructive/10 text-destructive",
  info: "border-info/20 bg-info/10 text-info",
  neutral: "border-border bg-muted text-muted-foreground",
  primary: "border-primary/20 bg-primary/10 text-primary",
}

function StatusBadge({ tone = "neutral", className, ...props }: React.ComponentProps<typeof Badge> & { tone?: StatusTone }) {
  return <Badge variant="outline" className={cn(toneClasses[tone], className)} {...props} />
}

export { StatusBadge }
