# Deployment

## Environments

Target environments:

```text
Local development
VPS staging
VPS production
```

All environments must use PostgreSQL through `DATABASE_URL`.

Do not depend on Supabase services for the MVP.

## Local Development

Use Docker Compose for PostgreSQL.

Expected services:

```text
postgres
```

Recommended local `.env`:

```env
DATABASE_URL=postgres://poultry:poultry@localhost:5432/poultry_receiving
SESSION_SECRET=replace-with-local-secret
APP_URL=http://localhost:3000
SITE_TIMEZONE=Asia/Jakarta
NODE_ENV=development
```

Recommended local commands:

```bash
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

## Docker Compose Database

Recommended PostgreSQL service:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: poultry
      POSTGRES_PASSWORD: poultry
      POSTGRES_DB: poultry_receiving
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U poultry -d poultry_receiving"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

The implementation may extend this compose file with the app service when preparing VPS deployment.

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

## Production Notes

- Use strong database password.
- Do not expose PostgreSQL port publicly.
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
