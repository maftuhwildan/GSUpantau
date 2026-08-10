'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { WebSocketMessage } from '@/lib/ws';

type LocalRealtimeMessage = WebSocketMessage | {
  type: 'realtime.reconnected' | 'realtime.poll';
  occurred_at: string;
  payload: Record<string, unknown>;
};

type WebSocketContextType = {
  lastMessage: LocalRealtimeMessage | null;
  isConnected: boolean;
};

const WebSocketContext = createContext<WebSocketContextType>({
  lastMessage: null,
  isConnected: false,
});

export const useWebSocket = () => useContext(WebSocketContext);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [lastMessage, setLastMessage] = useState<LocalRealtimeMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollingTimer: ReturnType<typeof setInterval> | null = null;
    let closedByUnmount = false;
    let retryCount = 0;
    let hasConnectedOnce = false;

    function emitLocal(type: 'realtime.reconnected' | 'realtime.poll', payload: Record<string, unknown> = {}) {
      setLastMessage({
        type,
        occurred_at: new Date().toISOString(),
        payload,
      });
    }

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

      socket.onopen = () => {
        setIsConnected(true);
        retryCount = 0;

        if (hasConnectedOnce) {
          emitLocal('realtime.reconnected');
        }
        hasConnectedOnce = true;
      };

      socket.onmessage = (event) => {
        try {
          setLastMessage(JSON.parse(event.data) as WebSocketMessage);
        } catch (err) {
          console.error('Pesan realtime tidak valid:', err);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
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
    <WebSocketContext.Provider value={{ lastMessage, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
}
