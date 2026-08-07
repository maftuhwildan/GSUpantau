'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in-0">
      <div
        className="fixed inset-0"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100 max-h-[90vh] flex flex-col">
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 p-6 border-b border-slate-100 dark:border-slate-800', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function DialogTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-lg font-semibold leading-none tracking-tight text-foreground', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function DialogDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-xs text-muted-foreground', className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function DialogContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-6 overflow-y-auto space-y-4 flex-1', className)} {...props}>
      {children}
    </div>
  );
}

export function DialogFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50', className)}
      {...props}
    >
      {children}
    </div>
  );
}
