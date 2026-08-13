import * as React from "react"

import { Card, CardContent } from "@/components/ui/card"
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
    <Card size="sm" className={cn("min-w-0 gap-0 py-0", className)}>
      <CardContent className="flex flex-col gap-3 px-4 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="mb-0.5 text-xs font-medium text-muted-foreground">{eyebrow}</p> : null}
          <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description ? <p className="mt-0.5 max-w-3xl text-sm leading-snug text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">{actions}</div> : null}
      </CardContent>
    </Card>
  )
}

export { PageHeader }
