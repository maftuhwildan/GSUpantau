# Deployment

## Environments

Target environments:

```text
Local application development + VPS development database
VPS staging
VPS production
```

All environments must use PostgreSQL through `DATABASE_URL`.

The current development topology keeps PostgreSQL in Docker Compose on the VPS. Developer laptops run the Next.js application locally and access the development database over Tailscale.

Do not depend on Supabase services for the MVP.

## Local Development

PostgreSQL does not need to be installed or run on the developer laptop. The laptop must be connected to the same Tailscale network as the VPS.

Development topology:

```text
Developer laptop
  -> local Next.js development server
  -> Tailscale private network
  -> PostgreSQL 16 in Docker Compose on VPS
```

Recommended local `.env`:

```env
DATABASE_URL=postgres://poultry:poultry@your-vps-tailnet-name:5432/poultry_receiving
DATABASE_TEST_URL=postgres://poultry:poultry@your-vps-tailnet-name:5432/poultry_receiving_test
SESSION_SECRET=replace-with-local-secret
APP_URL=http://localhost:3000
SITE_TIMEZONE=Asia/Jakarta
NODE_ENV=development
```

Use a Tailscale MagicDNS name or the VPS Tailscale IP as the database host. URL-encode special characters in the database password. Keep the real `.env` outside Git.

Recommended local commands:

```powershell
Test-NetConnection your-vps-tailnet-name -Port 5432
npm install
npm run db:migrate
npm run dev
```

Run `npm run db:seed` only for a dedicated development database and only when seed data is required. Do not seed staging or production databases.

## Development Database on VPS

Run PostgreSQL through Docker Compose on the VPS. Use a persistent volume and automatic restart policy. The database port must only be reachable through Tailscale, never through the public VPS interface.

Recommended PostgreSQL service:

```yaml
services:
  postgres:
    image: postgres:16
    container_name: poultry_receiving_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-poultry}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-poultry}
      POSTGRES_DB: ${POSTGRES_DB:-poultry_receiving}
    ports:
      - "${TAILSCALE_IP:-127.0.0.1}:5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER:-poultry} -d $${POSTGRES_DB:-poultry_receiving}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

Set `TAILSCALE_IP` in the Compose environment to the VPS address on the Tailnet, for example `100.x.y.z`. Also enforce the restriction with the VPS firewall. If the application later runs in the same Compose project, it can reach PostgreSQL using the internal hostname `postgres` without publishing the database port to the application container.

Keep development, test, staging, and production in separate databases and preferably separate database users:

```text
poultry_receiving_dev
poultry_receiving_test
poultry_receiving_staging
poultry_receiving
```

Never point automated tests or `db:seed` at `poultry_receiving` production.

Current environment status: The test database setup is formalized with `DATABASE_TEST_URL` and a mechanical safety guard (`assertTestDatabase`). Destructive integration setup or test execution automatically aborts if the database name does not end in `_test`. Automated PostgreSQL integration tests run serially against `DATABASE_TEST_URL` via `npm run test:pg`.

## VPS Deployment Shape

Recommended VPS deployment uses Docker Compose.

Services:

```text
app
postgres
reverse-proxy optional
backup optional
```

The app service should receive configuration through environment variables.

Production `.env` example:

```env
DATABASE_URL=postgres://poultry:strong-password@postgres:5432/poultry_receiving
SESSION_SECRET=strong-random-secret
APP_URL=https://receiving.example.com
SITE_TIMEZONE=Asia/Jakarta
NODE_ENV=production
```

## Reverse Proxy WebSocket Upgrade

Batch 14 uses a custom Node server that serves Next.js and the authenticated
WebSocket endpoint at `/ws`. Any reverse proxy in front of the app must pass
HTTP Upgrade requests to the app container.

Nginx example:

```nginx
location /ws {
  proxy_pass http://app:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_read_timeout 75s;
}
```

Caddy example:

```caddyfile
receiving.example.com {
  reverse_proxy app:3000
}
```

Do not terminate or strip the `Cookie` header for `/ws`; the server authenticates
the handshake with the same secure HttpOnly session cookie used by protected API
routes. The WebSocket stream is only a notification channel, so dashboards must
continue to refetch authoritative state from HTTP APIs after reconnect and fall
back to polling when the socket is unavailable.

When the app runs inside the same VPS Compose network, use `postgres` as the hostname. When a developer laptop connects to the development database, use the VPS Tailscale hostname or IP instead.

## Production Notes

- Use strong database password.
- Do not expose PostgreSQL port publicly; allow direct database access only through Tailscale or the internal Docker network.
- Put the app behind HTTPS.
- Store `.env` outside git.
- Use persistent Docker volumes.
- Enable automatic restart policy for app and database.
- Use server firewall rules.
- Keep VPS clock synchronized with NTP.

## Backup & Restore

Use `pg_dump` for backup.

Manual backup example:

```bash
docker compose exec postgres pg_dump -U poultry poultry_receiving > backup.sql
```

Restore example into clean database:

```bash
docker compose exec -T postgres psql -U poultry poultry_receiving < backup.sql
```

Recommended production policy:

- Daily backup.
- Keep at least 7 daily backups.
- Store backup outside the main database volume.
- Periodically test restore.

## Migration & Rollback Flow

From a developer laptop connected to Tailscale:

```powershell
Test-NetConnection your-vps-tailnet-name -Port 5432
npm run db:migrate
```

Deployment migration steps:

```text
1. Create database backup (pg_dump)
2. Pull latest code
3. Build app image
4. Run database migrations (npm run db:migrate)
5. Restart app service
6. Verify health via GET /api/health
```

If a rollback is required, restore the latest pre-migration database snapshot using `psql` and revert the application container to the previous image tag.

## Health Checks

The application exposes a health endpoint:

```text
GET /api/health
```

Checks performed:

- App status & uptime.
- Database connectivity (`SELECT 1`) & latency.
- Migration state (`__drizzle_migrations` table check and count).
- WebSocket broadcaster & client connection status.

Response:
- HTTP 200 when database, migrations, and WebSocket are healthy.
- HTTP 503 Service Unavailable if database connection or WebSocket fails.

## Smoke Testing & Verification

Run these validation commands before and after deployment:

```powershell
npm run test:pg
npm run lint
npm run typecheck
npm test
npm run build
```

## Device Network

Recommended RPA local network:

```text
ESP32 devices -> Wi-Fi access point -> app/backend server
Operator/Admin browser -> app/backend server
```

For local/VPS hybrid scenarios, ensure ESP32 devices can reach the backend API reliably.

If production uses a local PC server instead of cloud VPS, keep the same Docker Compose shape and use local network DNS/IP.

## Security

- Device credentials must be separate from user credentials.
- Store device credential hashes.
- Rotate device credentials from Admin UI.
- Use HTTPS for production when traffic crosses untrusted networks.
- Avoid exposing device APIs publicly without network restrictions.
- Keep audit logs append-only from the application.
