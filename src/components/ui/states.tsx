import type { LucideIcon } from "lucide-react"
import { AlertCircle, Inbox, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

function EmptyState({ title, description, icon: Icon = Inbox }: { title: string; description?: string; icon?: LucideIcon }) {
  return <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-6 text-center"><Icon className="mb-3 size-8 text-muted-foreground" /><p className="font-medium">{title}</p>{description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}</div>
}

function ErrorState({ title = "Data tidak dapat dimuat", description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return <Alert variant="destructive"><AlertCircle /> <AlertTitle>{title}</AlertTitle>{description ? <AlertDescription>{description}</AlertDescription> : null}{onRetry ? <Button className="mt-3 w-fit" size="sm" variant="outline" onClick={onRetry}><RefreshCw />Coba Lagi</Button> : null}</Alert>
}

export { EmptyState, ErrorState }
