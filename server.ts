import 'dotenv/config';
import { createServer } from 'node:http';
import next from 'next';
import { attachWebSocketEndpoint } from './src/server/realtime/websocket-server';
import { startDeviceHealthMonitor } from './src/server/device-health-monitor';

const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOSTNAME || '0.0.0.0';
const forceProduction = process.argv.includes('--production');
const dev = !forceProduction && process.env.NODE_ENV !== 'production';

async function main() {
  let handle: ReturnType<ReturnType<typeof next>['getRequestHandler']>;
  const server = createServer((req, res) => {
    handle(req, res);
  });
  const app = next({
    dev,
    hostname,
    port,
    customServer: false,
    httpServer: server,
  } as Parameters<typeof next>[0]);
  handle = app.getRequestHandler();
  const nextUpgradeHandler = app.getUpgradeHandler();

  await app.prepare();

  attachWebSocketEndpoint(server, nextUpgradeHandler);
  startDeviceHealthMonitor();

  server.listen(port, hostname, () => {
    console.log(
      `Server siap di http://${hostname}:${port} (${dev ? 'development' : 'production'})`
    );
  });
}

main().catch((error) => {
  console.error('Gagal menjalankan server aplikasi:', error);
  process.exit(1);
});
