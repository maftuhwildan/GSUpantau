import * as React from "react"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  eyebrow?: string
  actions?: React.ReactNode
  className?: string
}

function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between sm:p-6", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p> : null}
        <h1 className="truncate font-heading text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div> : null}
    </section>
  )
}

export { PageHeader }
