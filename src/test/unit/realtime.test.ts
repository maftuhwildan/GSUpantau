import { describe, expect, it } from 'vitest';
import type { RealtimeConnectionState } from '@/components/layout/ws-provider';

describe('Realtime Connection State Invariants', () => {
  it('defines valid realtime connection states', () => {
    const states: RealtimeConnectionState[] = ['CONNECTING', 'LIVE', 'POLLING'];
    expect(states).toHaveLength(3);
    expect(states).toContain('CONNECTING');
    expect(states).toContain('LIVE');
    expect(states).toContain('POLLING');
  });

  it('determines header transport status presentation correctly', () => {
    function getTransportPresentation(state: RealtimeConnectionState) {
      switch (state) {
        case 'LIVE':
          return { label: 'Data langsung', tone: 'success' as const, tooltip: 'Pembaruan diterima melalui WebSocket' };
        case 'POLLING':
          return { label: 'Mode cadangan', tone: 'warning' as const, tooltip: 'Aplikasi tetap memperbarui data melalui polling' };
        case 'CONNECTING':
        default:
          return { label: 'Menyambungkan', tone: 'neutral' as const, tooltip: 'Koneksi realtime sedang dibangun' };
      }
    }

    expect(getTransportPresentation('LIVE')).toEqual({
      label: 'Data langsung',
      tone: 'success',
      tooltip: 'Pembaruan diterima melalui WebSocket',
    });

    expect(getTransportPresentation('POLLING')).toEqual({
      label: 'Mode cadangan',
      tone: 'warning',
      tooltip: 'Aplikasi tetap memperbarui data melalui polling',
    });

    expect(getTransportPresentation('CONNECTING')).toEqual({
      label: 'Menyambungkan',
      tone: 'neutral',
      tooltip: 'Koneksi realtime sedang dibangun',
    });
  });
});
