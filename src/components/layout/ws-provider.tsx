'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { WebSocketMessage } from '@/lib/ws';

export type RealtimeConnectionState = 'CONNECTING' | 'LIVE' | 'POLLING';

export type LocalRealtimeMessage = WebSocketMessage | {
  type: 'realtime.reconnected' | 'realtime.poll';
  occurred_at: string;
  payload: Record<string, unknown>;
};

export type WebSocketContextType = {
  lastMessage: LocalRealtimeMessage | null;
  isConnected: boolean;
  connectionState: RealtimeConnectionState;
  lastRealtimeActivityAt: string | null;
};

const WebSocketContext = createContext<WebSocketContextType>({
  lastMessage: null,
  isConnected: false,
  connectionState: 'CONNECTING',
  lastRealtimeActivityAt: null,
});

export const useWebSocket = () => useContext(WebSocketContext);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [lastMessage, setLastMessage] = useState<LocalRealtimeMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>('CONNECTING');
  const [lastRealtimeActivityAt, setLastRealtimeActivityAt] = useState<string | null>(null);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollingTimer: ReturnType<typeof setInterval> | null = null;
    let closedByUnmount = false;
    let retryCount = 0;
    let hasConnectedOnce = false;

    function emitLocal(type: 'realtime.reconnected' | 'realtime.poll', payload: Record<string, unknown> = {}) {
      const now = new Date().toISOString();
      setLastMessage({
        type,
        occurred_at: now,
        payload,
      });
      setLastRealtimeActivityAt(now);
    }

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

      socket.onopen = () => {
        const now = new Date().toISOString();
        setIsConnected(true);
        setConnectionState('LIVE');
        setLastRealtimeActivityAt(now);
        retryCount = 0;

        if (hasConnectedOnce) {
          emitLocal('realtime.reconnected');
        }
        hasConnectedOnce = true;
      };

      socket.onmessage = (event) => {
        try {
          const now = new Date().toISOString();
          const parsed = JSON.parse(event.data) as WebSocketMessage;
          setLastMessage(parsed);
          setLastRealtimeActivityAt(now);
        } catch (err) {
          console.error('Pesan realtime tidak valid:', err);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        setConnectionState('POLLING');
        if (closedByUnmount) return;

        const delay = Math.min(30_000, 1_000 * 2 ** retryCount);
        retryCount += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        socket?.close();
      };
    }

    pollingTimer = setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        emitLocal('realtime.poll', { reason: 'websocket_unavailable' });
      }
    }, 10_000);

    connect();

    return () => {
      closedByUnmount = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pollingTimer) clearInterval(pollingTimer);
      socket?.close();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ lastMessage, isConnected, connectionState, lastRealtimeActivityAt }}>
      {children}
    </WebSocketContext.Provider>
  );
}
