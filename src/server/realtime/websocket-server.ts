import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { SESSION_COOKIE_NAME, getSessionFromToken } from '@/lib/auth';
import { wsBroadcaster } from '@/lib/ws';

const HEARTBEAT_INTERVAL_MS = 30_000;
type UpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => Promise<void> | void;

function getCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) return null;
  return decodeURIComponent(cookie.slice(name.length + 1));
}

export async function authenticateWebSocketRequest(req: IncomingMessage) {
  const token = getCookieValue(req.headers.cookie, SESSION_COOKIE_NAME);
  if (!token) return null;

  return getSessionFromToken(token);
}

function rejectUpgrade(socket: Duplex, statusCode: number, message: string) {
  socket.write(
    `HTTP/1.1 ${statusCode} ${message}\r\n` +
      'Connection: close\r\n' +
      'Content-Type: text/plain; charset=utf-8\r\n' +
      `Content-Length: ${Buffer.byteLength(message)}\r\n` +
      '\r\n' +
      message
  );
  socket.destroy();
}

export function attachWebSocketEndpoint(server: Server, fallbackUpgradeHandler?: UpgradeHandler) {
  const wss = new WebSocketServer({ noServer: true });
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      const socket = ws as WebSocket & { isAlive?: boolean };
      if (socket.isAlive === false) {
        socket.terminate();
        return;
      }

      socket.isAlive = false;
      socket.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => clearInterval(heartbeat));

  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname !== '/ws') {
      if (fallbackUpgradeHandler) {
        await fallbackUpgradeHandler(req, socket, head);
      }
      return;
    }

    const user = await authenticateWebSocketRequest(req);
    if (!user) {
      rejectUpgrade(socket, 401, 'Unauthorized');
      return;
    }

    if (!user.roles.includes('ADMIN') && !user.assignedLineId) {
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const socket = ws as WebSocket & { isAlive?: boolean };
      socket.isAlive = true;

      const unregister = wsBroadcaster.registerClient({
        id: randomUUID(),
        userId: user.id,
        roles: user.roles,
        assignedLineId: user.assignedLineId,
        send: (msg) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
          }
        },
      });

      ws.on('pong', () => {
        socket.isAlive = true;
      });
      ws.on('close', unregister);
      ws.on('error', unregister);
      wss.emit('connection', ws, req);
    });
  });

  return wss;
}
