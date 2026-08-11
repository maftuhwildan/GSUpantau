import * as React from "react"

import { cn } from "@/lib/utils"

function FilterToolbar({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex w-full flex-col gap-3 rounded-2xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 sm:flex-row sm:flex-wrap sm:items-end", className)} {...props} />
}

export { FilterToolbar }
