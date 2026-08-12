import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { AlertCircle, Inbox, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

function EmptyState({ title, description, icon: Icon = Inbox, action }: { title: string; description?: string; icon?: LucideIcon; action?: ReactNode }) {
  return <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-6 text-center"><Icon className="mb-3 size-8 text-muted-foreground" /><p className="font-medium">{title}</p>{description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}{action ? <div className="mt-4">{action}</div> : null}</div>
}

function ErrorState({ title = "Data tidak dapat dimuat", description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return <Alert variant="destructive"><AlertCircle /> <AlertTitle>{title}</AlertTitle>{description ? <AlertDescription>{description}</AlertDescription> : null}{onRetry ? <Button className="mt-3 w-fit" size="sm" variant="outline" onClick={onRetry}><RefreshCw />Coba Lagi</Button> : null}</Alert>
}

function LoadingState({ label = "Memuat data...", rows = 3, className }: { label?: string; rows?: number; className?: string }) {
  return <div className={cn("space-y-3 rounded-2xl border bg-card p-4", className)} role="status" aria-label={label} aria-busy="true"><span className="sr-only">{label}</span>{Array.from({ length: rows }, (_, index) => <Skeleton key={index} className={cn("h-12 w-full", index === rows - 1 && "w-3/4")} />)}</div>
}

export { EmptyState, ErrorState, LoadingState }
