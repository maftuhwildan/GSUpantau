import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  canDeliverRealtimeMessage,
  wsBroadcaster,
  type WebSocketMessage,
} from '@/lib/ws';

function message(type: WebSocketMessage['type'], payload: Record<string, unknown>): WebSocketMessage {
  return {
    type,
    occurred_at: new Date().toISOString(),
    payload,
  };
}

describe('Batch 14 realtime websocket filtering', () => {
  beforeEach(() => {
    wsBroadcaster.clearClientsForTest();
  });

  it('allows Admin users to receive every realtime message', () => {
    expect(
      canDeliverRealtimeMessage(
        { roles: ['ADMIN'], assignedLineId: null },
        message('audit.created', { entity_id: 'audit-1' })
      )
    ).toBe(true);

    expect(
      canDeliverRealtimeMessage(
        { roles: ['ADMIN'], assignedLineId: null },
        message('sensor.event_received', { line_id: 'line-2' })
      )
    ).toBe(true);
  });

  it('delivers line-scoped messages only to Operators assigned to that line', () => {
    const lineOneCounter = message('session.counter_updated', {
      line_id: 'line-1',
      session_id: 'session-1',
      actual_count: 7,
    });

    expect(
      canDeliverRealtimeMessage(
        { roles: ['OPERATOR'], assignedLineId: 'line-1' },
        lineOneCounter
      )
    ).toBe(true);

    expect(
      canDeliverRealtimeMessage(
        { roles: ['OPERATOR'], assignedLineId: 'line-2' },
        lineOneCounter
      )
    ).toBe(false);
  });

  it('does not deliver unscoped payloads or line-less Operator sessions to Operators', () => {
    expect(
      canDeliverRealtimeMessage(
        { roles: ['OPERATOR'], assignedLineId: 'line-1' },
        message('audit.created', { entity_id: 'audit-1' })
      )
    ).toBe(false);

    expect(
      canDeliverRealtimeMessage(
        { roles: ['OPERATOR'], assignedLineId: null },
        message('sensor.event_received', { line_id: 'line-1' })
      )
    ).toBe(false);
  });

  it('broadcasts to authenticated clients using the same line filter', () => {
    const adminMessages: WebSocketMessage[] = [];
    const lineOneMessages: WebSocketMessage[] = [];
    const lineTwoMessages: WebSocketMessage[] = [];

    const unregisterAdmin = wsBroadcaster.registerClient({
      id: 'admin-client',
      userId: 'admin',
      roles: ['ADMIN'],
      assignedLineId: null,
      send: (msg) => adminMessages.push(msg),
    });
    const unregisterLineOne = wsBroadcaster.registerClient({
      id: 'operator-line-1',
      userId: 'operator-1',
      roles: ['OPERATOR'],
      assignedLineId: 'line-1',
      send: (msg) => lineOneMessages.push(msg),
    });
    const unregisterLineTwo = wsBroadcaster.registerClient({
      id: 'operator-line-2',
      userId: 'operator-2',
      roles: ['OPERATOR'],
      assignedLineId: 'line-2',
      send: (msg) => lineTwoMessages.push(msg),
    });

    wsBroadcaster.broadcast('sensor.event_received', {
      line_id: 'line-1',
      device_id: 'device-1',
      event_type: 'DETECTION',
    });
    wsBroadcaster.broadcast('audit.created', {
      audit_log_id: 'audit-1',
      action: 'SESSION_START',
    });

    expect(adminMessages.map((msg) => msg.type)).toEqual([
      'sensor.event_received',
      'audit.created',
    ]);
    expect(lineOneMessages.map((msg) => msg.type)).toEqual(['sensor.event_received']);
    expect(lineTwoMessages).toHaveLength(0);

    unregisterAdmin();
    unregisterLineOne();
    unregisterLineTwo();
  });

  it('removes websocket clients whose send operation fails', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    wsBroadcaster.registerClient({
      id: 'closed-client',
      userId: 'operator-1',
      roles: ['OPERATOR'],
      assignedLineId: 'line-1',
      send: () => {
        throw new Error('socket closed');
      },
    });

    expect(wsBroadcaster.getClientCount()).toBe(1);

    wsBroadcaster.broadcast('session.counter_updated', {
      line_id: 'line-1',
      session_id: 'session-1',
      actual_count: 8,
    });

    expect(wsBroadcaster.getClientCount()).toBe(0);
    consoleSpy.mockRestore();
  });
});
