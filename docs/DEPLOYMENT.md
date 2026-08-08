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
DATABASE_URL=postgres://poultry_dev:strong-development-password@your-vps-tailnet-name:5432/poultry_receiving_dev
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
    restart: unless-stopped
    env_file:
      - .env.postgres
    ports:
      - "${TAILSCALE_IP}:5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

Example VPS-only `.env.postgres` values:

```env
POSTGRES_USER=poultry_dev
POSTGRES_PASSWORD=strong-development-password
POSTGRES_DB=poultry_receiving_dev
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

Current environment status, confirmed by the operator on 2026-08-08: the database reached by the developer's active connection is a dedicated test database on the VPS, not the operational production database. Migrations and integration checks may run directly against it through Tailscale. Before destructive fixtures or seed operations, verify that the resolved database is the designated test database. Batch 20 will replace this manual confirmation with a `DATABASE_TEST_URL` guard requiring a database name ending in `_test`.

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

## Backup

Use `pg_dump` for backup.

Manual backup example:

```bash
docker compose exec postgres pg_dump -U poultry poultry_receiving > backup.sql
```

Restore example:

```bash
docker compose exec -T postgres psql -U poultry poultry_receiving < backup.sql
```

Recommended production policy:

- Daily backup.
- Keep at least 7 daily backups.
- Store backup outside the main database volume.
- Periodically test restore.
- Consider off-server backup copy.

## Migration Flow

From a developer laptop connected to Tailscale:

```powershell
Test-NetConnection your-vps-tailnet-name -Port 5432
npm run db:migrate
```

The migration command reads `DATABASE_URL` from `.env` and applies only migrations that are not yet recorded by Drizzle. Back up databases containing operational data before applying a new migration.

Recommended deployment migration flow:

```text
pull latest code
build app image
start/update services
run database migrations
restart app if needed
verify health
```

Migrations must be reviewed carefully because receiving and sensor event data are operational records.

Current VPS database status, confirmed by the operator on 2026-08-08: migration `0002_remarkable_lizard.sql`, which adds `boot_id` and uniqueness on `(device_id, boot_id, sequence)`, has been applied.

## Health Checks

The app should eventually expose a health endpoint:

```text
GET /api/health
```

Minimum checks:

- App process alive.
- Database reachable.
- Migration version readable.
- WebSocket service initialized.

Admin dashboard can display:

- PostgreSQL status.
- App version.
- Device online/offline summary.
- Last backup timestamp.

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
