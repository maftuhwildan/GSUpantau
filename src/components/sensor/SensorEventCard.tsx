'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Cpu, Clock, Hash, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface SensorEventCardProps {
  event: {
    id: string;
    eventType: string;
    assignmentStatus?: string;
    receivedAt: string | Date;
    deviceTime: string | Date;
    sequence: number;
    bootId: string;
    device?: { deviceCode?: string; name?: string } | null;
    deviceId?: string;
    line?: { name?: string; lineCode?: string } | null;
    sessionId?: string | null;
  };
  isAdmin?: boolean;
}

export function SensorEventCard({ event, isAdmin = false }: SensorEventCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const eventLabel =
    event.eventType === 'DETECTION'
      ? 'Deteksi'
      : event.eventType === 'HEARTBEAT'
      ? 'Heartbeat'
      : event.eventType === 'DEVICE_RESTART'
      ? 'Mulai Ulang Perangkat'
      : event.eventType;

  const assignmentLabel =
    event.assignmentStatus === 'ASSIGNED'
      ? 'Terhubung sesi'
      : event.assignmentStatus === 'UNASSIGNED'
      ? 'Tanpa sesi'
      : event.assignmentStatus || '-';

  const deviceCode = event.device?.deviceCode || event.deviceId || '-';

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/20"
    >
      <div className="flex flex-col gap-3">
        {/* Main Card Header Info */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={event.eventType === 'DETECTION' ? 'default' : 'outline'}
                className="text-xs font-semibold"
              >
                {eventLabel}
              </Badge>
              {event.eventType === 'DETECTION' && (
                <StatusBadge tone={event.assignmentStatus === 'ASSIGNED' ? 'success' : 'warning'}>
                  {assignmentLabel}
                </StatusBadge>
              )}
            </div>
            <p className="text-xs font-mono text-muted-foreground pt-1">
              Diterima: {new Date(event.receivedAt).toLocaleString('id-ID')}
            </p>
          </div>

          <Badge variant="secondary" className="font-mono text-xs shrink-0">
            {deviceCode}
          </Badge>
        </div>

        {/* Collapsible Detail Toggle Trigger */}
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-xs text-muted-foreground font-mono">
            Seq #{event.sequence}
          </span>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={isOpen}
              aria-label={isOpen ? 'Tutup detail teknis' : 'Lihat detail teknis'}
              className="h-11 min-h-[44px] px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <span>{isOpen ? 'Tutup detail' : 'Lihat detail'}</span>
              {isOpen ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
            </Button>
          </CollapsibleTrigger>
        </div>

        {/* Collapsible Detail Content */}
        <CollapsibleContent className="space-y-2 pt-2 border-t text-xs font-mono text-muted-foreground">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Clock className="size-3.5 shrink-0 text-foreground" />
              <span>Waktu Alat (Device Time):</span>
              <span className="text-foreground">{new Date(event.deviceTime).toLocaleTimeString('id-ID')}</span>
            </div>

            <div className="flex items-center gap-2">
              <Hash className="size-3.5 shrink-0 text-foreground" />
              <span>Sequence:</span>
              <span className="text-foreground">#{event.sequence}</span>
            </div>

            <div className="flex items-center gap-2">
              <Cpu className="size-3.5 shrink-0 text-foreground" />
              <span>Boot ID:</span>
              <span className="text-foreground truncate">{event.bootId}</span>
            </div>

            {isAdmin && event.line && (
              <div className="flex items-center gap-2">
                <Layers className="size-3.5 shrink-0 text-foreground" />
                <span>Jalur:</span>
                <span className="text-foreground">{event.line.name || event.line.lineCode}</span>
              </div>
            )}

            {event.sessionId && (
              <div className="flex items-center gap-2 sm:col-span-2">
                <span className="font-semibold text-foreground">Sesi ID:</span>
                <span className="text-foreground truncate">{event.sessionId}</span>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
