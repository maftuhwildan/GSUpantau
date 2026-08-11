"use client"

import * as React from "react"
import { format } from "date-fns"
import { id as idLocale } from "react-day-picker/locale"
import { CalendarDays } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  formatDateOnly,
  parseDateOnly,
  type DateOnlyRange,
} from "@/lib/ui-date"

interface DatePickerProps {
  id?: string
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
}

function DatePicker({
  id,
  value,
  onValueChange,
  placeholder = "Pilih tanggal",
  disabled,
  required,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseDateOnly(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-required={required}
          disabled={disabled}
          className={cn(
            "h-11 w-full justify-start px-3 text-left font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <CalendarDays className="size-4" />
          {selected ? format(selected, "PPP", { locale: idLocale }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (!date) return
            onValueChange(formatDateOnly(date))
            setOpen(false)
          }}
          locale={idLocale}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

interface DateRangePickerProps {
  id?: string
  value: DateOnlyRange
  onValueChange: (value: DateOnlyRange) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

function DateRangePicker({
  id,
  value,
  onValueChange,
  placeholder = "Pilih rentang tanggal",
  disabled,
  className,
}: DateRangePickerProps) {
  const isMobile = useIsMobile()
  const selected: DateRange = {
    from: parseDateOnly(value.from),
    to: parseDateOnly(value.to),
  }

  const label = selected.from
    ? selected.to
      ? `${format(selected.from, "d MMM yyyy", { locale: idLocale })} – ${format(selected.to, "d MMM yyyy", { locale: idLocale })}`
      : `Mulai ${format(selected.from, "d MMM yyyy", { locale: idLocale })}`
    : placeholder

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-11 w-full justify-start px-3 text-left font-normal",
            !selected.from && "text-muted-foreground",
            className
          )}
        >
          <CalendarDays className="size-4" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] overflow-x-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={selected}
          onSelect={(range) =>
            onValueChange({
              from: formatDateOnly(range?.from),
              to: formatDateOnly(range?.to),
            })
          }
          numberOfMonths={isMobile ? 1 : 2}
          locale={idLocale}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker, DateRangePicker }
export type { DateOnlyRange }
