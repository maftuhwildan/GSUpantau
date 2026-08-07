export interface WebSocketMessage {
  type:
    | 'session.started'
    | 'session.counter_updated'
    | 'session.finished'
    | 'session.cancelled'
    | 'receiving.queue_updated'
    | 'sensor.event_received'
    | 'device.status_updated'
    | 'audit.created';
  occurred_at: string;
  payload: Record<string, unknown>;
}

type EventListener = (msg: WebSocketMessage) => void;

class WebSocketBroadcaster {
  private listeners: Set<EventListener> = new Set();

  public subscribe(listener: EventListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
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
  }
}

// Global singleton for WebSocket broadcasting
const globalForWs = globalThis as unknown as { wsBroadcaster: WebSocketBroadcaster };

export const wsBroadcaster = globalForWs.wsBroadcaster || new WebSocketBroadcaster();

if (process.env.NODE_ENV !== 'production') {
  globalForWs.wsBroadcaster = wsBroadcaster;
}
