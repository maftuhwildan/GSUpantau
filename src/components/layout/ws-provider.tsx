'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type WebSocketContextType = {
  lastMessage: any | null;
  isConnected: boolean;
};

const WebSocketContext = createContext<WebSocketContextType>({
  lastMessage: null,
  isConnected: false,
});

export const useWebSocket = () => useContext(WebSocketContext);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [lastMessage, setLastMessage] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Basic polling fallback for MVP since standard WebSocket needs separate server 
    // or Next.js custom server setup which might not be fully wired on the frontend yet.
    const interval = setInterval(() => {
      // Periodic trigger for UI refresh if needed
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <WebSocketContext.Provider value={{ lastMessage, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
}
