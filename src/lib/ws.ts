export interface WebSocketMessage {
  type:
    | 'session.started'
    | 'session.counter_updated'
    | 'session.finished'
    | 'session.cancelled'
    | 'receiving.queue_updated'
    | 'sensor.event_received'
    | 'device.heartbeat_received'
    | 'device.status_updated'
    | 'audit.created';
  occurred_at: string;
  payload: Record<string, unknown>;
}

type EventListener = (msg: WebSocketMessage) => void;

export interface RealtimeClient {
  id: string;
  userId: string;
  roles: string[];
  assignedLineId?: string | null;
  send: (msg: WebSocketMessage) => void;
  close?: () => void;
}

function payloadLineIds(payload: Record<string, unknown>): string[] {
  const lineIds = new Set<string>();
  const directLineId = payload.line_id;
  const directLineIds = payload.line_ids;

  if (typeof directLineId === 'string' && directLineId.length > 0) {
    lineIds.add(directLineId);
  }

  if (Array.isArray(directLineIds)) {
    directLineIds.forEach((lineId) => {
      if (typeof lineId === 'string' && lineId.length > 0) {
        lineIds.add(lineId);
      }
    });
  }

  return Array.from(lineIds);
}

export function canDeliverRealtimeMessage(client: Pick<RealtimeClient, 'roles' | 'assignedLineId'>, msg: WebSocketMessage) {
  if (client.roles.includes('ADMIN')) {
    return true;
  }

  if (!client.roles.includes('OPERATOR') || !client.assignedLineId) {
    return false;
  }

  const lineIds = payloadLineIds(msg.payload);
  return lineIds.length > 0 && lineIds.includes(client.assignedLineId);
}

class WebSocketBroadcaster {
  private listeners: Set<EventListener> = new Set();
  private clients: Map<string, RealtimeClient> = new Map();

  public subscribe(listener: EventListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public registerClient(client: RealtimeClient) {
    this.clients.set(client.id, client);

    return () => {
      this.clients.delete(client.id);
    };
  }

  public disconnectUser(userId: string) {
    this.clients.forEach((client, clientId) => {
      if (client.userId === userId) {
        if (typeof client.close === 'function') {
          try {
            client.close();
          } catch (err) {
            console.error('Error closing websocket client:', err);
          }
        }
        this.clients.delete(clientId);
      }
    });
  }

  public getClientCount() {
    return this.clients.size;
  }

  public clearClientsForTest() {
    if (process.env.NODE_ENV === 'test') {
      this.clients.clear();
    }
  }

  public broadcast(type: WebSocketMessage['type'], payload: Record<string, unknown>) {
    const msg: WebSocketMessage = {
      type,
      occurred_at: new Date().toISOString(),
      payload,
    };

    this.listeners.forEach((listener) => {
      try {
        listener(msg);
      } catch (err) {
        console.error('Error in websocket listener:', err);
      }
    });

    this.clients.forEach((client, clientId) => {
      if (!canDeliverRealtimeMessage(client, msg)) return;

      try {
        client.send(msg);
      } catch (err) {
        this.clients.delete(clientId);
        console.error('Error sending websocket message:', err);
      }
    });
  }
}

// Global singleton for WebSocket broadcasting
const globalForWs = globalThis as unknown as { wsBroadcaster: WebSocketBroadcaster };

export const wsBroadcaster = globalForWs.wsBroadcaster || new WebSocketBroadcaster();

if (process.env.NODE_ENV !== 'production') {
  globalForWs.wsBroadcaster = wsBroadcaster;
}
