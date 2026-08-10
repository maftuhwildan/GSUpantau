# Implementation Tasks

## Working Method

Implement one batch at a time.

Before coding each batch:

1. Read `AGENTS.md`.
2. Read all blueprint docs in `docs/`.
3. Confirm the target batch.
4. Implement only that batch.
5. Run the most relevant validation.
6. Stop and summarize changed files, validation results, and next batch.

Do not implement QR, physical button, hardware batch switch, Supabase dependency, or Supervisor role in the MVP.

## Batch 1: Project Scaffold and UI Foundation

Goal: create a runnable Next.js app with the base UI system.

Tasks:

- Scaffold Next.js App Router with TypeScript.
- Install and configure Tailwind CSS.
- Add shadcn/ui setup.
- Add lucide-react.
- Create base dashboard shell.
- Create route groups for auth, operator, admin.
- Create login page placeholder.
- Create Operator and Admin dashboard placeholders.
- Add theme tokens and sidebar gradient.
- Add initial README with dev commands.

Acceptance criteria:

- App runs locally.
- Admin and Operator layouts render.
- shadcn/ui components can be imported.
- UI copy is Bahasa Indonesia.
- No database logic required yet.

Validation:

```text
npm run lint
npm run typecheck
npm run build
```

## Batch 2: Database, Drizzle, Docker Compose on VPS, Seed

Goal: create PostgreSQL development database and schema.

Tasks:

- Add PostgreSQL Docker Compose service on the VPS.
- Connect developer machines to the VPS database through Tailscale.
- Add `.env.example`.
- Configure Drizzle ORM.
- Implement schema for core tables.
- Add migrations.
- Add seed script.
- Seed two roles, two users, two lines, two devices, master data, receiving examples, sessions, sensor events, audit logs.

Seed expectations:

- `operator@local.test` with `OPERATOR`.
- `admin@local.test` with `ADMIN`.
- 2 lines.
- 2 ESP32 devices.
- At least 5 trucks.
- At least 5 drivers.
- At least 3 suppliers.
- 1 completed receiving/session.
- 1 active receiving/session.
- Several waiting receiving items.
- Assigned and unassigned sensor events.

Acceptance criteria:

- `docker compose up -d postgres` starts PostgreSQL on the VPS.
- Developer machines can reach the development database through Tailscale without installing PostgreSQL locally.
- PostgreSQL port `5432` is not exposed to the public internet.
- Migrations run.
- Seed runs repeatedly in development.
- Schema enforces one active session per line using partial unique index.

Validation:

```text
npm run db:migrate
npm run db:seed
npm test
```

## Batch 3: Auth and Permissions

Goal: implement local session auth and backend authorization.

Tasks:

- Implement password hashing.
- Implement login/logout/session APIs.
- Implement HttpOnly session cookie.
- Implement role and permission mapping.
- Protect dashboard routes.
- Protect API route handlers with permissions.
- Add user menu/logout.

Acceptance criteria:

- Admin can log in and access Admin menu.
- Operator can log in and access Operator menu.
- Operator cannot access Admin-only APIs.
- Backend blocks unauthorized actions.

Validation:

```text
npm test
npm run typecheck
```

## Batch 4: Receiving Management

Goal: allow Admin to input delivery note data and publish queue items.

Tasks:

- Implement receiving list page.
- Implement receiving create/edit form.
- Implement publish action.
- Implement cancel action.
- Implement manifest revision when waiting manifest changes.
- Implement audit logs for receiving actions.
- Implement queue table component.

Acceptance criteria:

- Admin can create draft receiving.
- Admin can publish receiving to `WAITING`.
- Operator can see waiting queue but cannot edit receiving.
- Manifest revision stores old/new values and reason.

Validation:

```text
npm test
npm run build
```

## Batch 5: Session Start and Finish

Goal: implement core counting session lifecycle.

Tasks:

- Implement start session API.
- Implement finish session API.
- Implement cancel session API if included in MVP.
- Implement `CountingConsole`.
- Implement active session page.
- Enforce one active session per line in backend and database.
- Derive actual count from assigned sensor events.
- Write audit logs for start and finish.
- Broadcast WebSocket events when session changes.

Acceptance criteria:

- Operator can start a waiting receiving.
- Admin can start a waiting receiving.
- Only one active session can exist on one line.
- Finish requires confirmation.
- Finish completes session and receiving.
- Waiting receiving actual displays as empty/not counted, not zero.
- Manifest never auto-finishes a session.

Validation:

```text
npm test
npm run typecheck
```

## Batch 6: Device API, Sensor Events, WebSocket

Goal: implement ESP32 event ingestion and realtime counter updates.

Tasks:

- Implement device credential authentication.
- Implement `/api/device/events`.
- Implement `/api/device/heartbeat`.
- Implement `/api/device/config`.
- Handle batch event upload.
- Handle duplicate event idempotently.
- Assign detection to active session or unassigned.
- Preserve raw payload.
- Broadcast counter and sensor activity over WebSocket.
- Implement device status from heartbeat.

Acceptance criteria:

- Detection with active session increments derived actual.
- Detection without active session becomes unassigned.
- Duplicate event does not increment actual.
- Heartbeat updates device status.
- UI receives realtime counter updates.

Validation:

```text
npm test
npm run build
```

## Batch 7: Sensor Simulator

Goal: create development simulator that uses the real Device API.

Tasks:

- Add `/dev/sensor-simulator`.
- Select line and device.
- Send `+1 Detection`.
- Send `+10 Detection`.
- Start/stop auto detection.
- Send duplicate event.
- Send delayed event.
- Send heartbeat.
- Simulate device restart.
- Simulate offline by stopping heartbeat.

Rules:

- Simulator must call `/api/device/events` and `/api/device/heartbeat`.
- Simulator must not write directly to the database.
- Simulator must be development-only or Admin-only.

Acceptance criteria:

- Simulator can drive actual count in active session.
- Simulator can create unassigned detections when no session is active.
- Duplicate simulation proves idempotency.
- Restart simulation creates a new `boot_id` and resets sequence without losing future detections.

Validation:

```text
npm test
npm run build
```

## Batch 8: Dashboards, Reports, Audit, Polish

Goal: complete MVP screens and verification.

Tasks:

- Implement Operator dashboard.
- Implement Admin dashboard.
- Implement Sensor Activity page.
- Implement Reports page.
- Implement Audit Trail page.
- Add filters and basic exports if practical.
- Polish responsive layout.
- Add empty/loading/error states.
- Add final tests for dashboard calculations.

Acceptance criteria:

- Operator can run the full daily flow.
- Admin can run the full flow and manage data.
- Reports show manifest vs actual.
- Audit trail shows important actions.
- Sensor status and activity are visible.
- UI remains consistent with the design system.

Validation:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

## Database Environment for Batches 9–21

The current developer connection, as confirmed by the operator on 2026-08-08, points to a dedicated test database hosted in PostgreSQL Docker Compose on the VPS and reached through Tailscale. It is not the operational production database.

- Agents may apply migrations and run database integration checks directly against this VPS test database.
- PGlite may still be used by existing fast tests, but it is not a prerequisite for applying or validating PostgreSQL migrations.
- Seed data, destructive fixtures, and concurrency tests are allowed only after the target has been verified as the designated test database.
- Never redirect these commands to the future operational production database.
- Batch 20 must add a mechanical guard such as a `_test` database-name suffix and `DATABASE_TEST_URL`; operator confirmation alone must not remain the long-term safety control.

## Batch 9: Session Concurrency and Counting Boundaries

Goal: make session transitions and sensor assignment deterministic under concurrent requests.

Tasks:

- Add a partial unique index for one active `COUNTING` session per receiving.
- Serialize start, finish, cancel, and event assignment using a row lock on the related line.
- Reject a start when the requested line differs from the receiving line.
- Require the target line to have status `ACTIVE`.
- Use guarded status updates so concurrent transitions have exactly one winner.
- Update receiving reconciliation status when a session finishes.
- Keep cancelled-session events immutable while returning the receiving to `WAITING`.
- Broadcast session and sensor notifications only after transaction commit.

Acceptance criteria:

- A receiving cannot count on two lines at once.
- Concurrent start, finish, and cancel requests do not create partial or duplicate transitions.
- An event committed before finish is included in final actual.
- An event committed after finish becomes `UNASSIGNED`.
- Transaction rollback does not produce realtime notifications.

Validation:

```text
npm test -- src/test/session.test.ts src/test/device.test.ts src/test/db-schema.test.ts
npm run typecheck
npm run build
```

## Batch 10: Actual Count, Dashboard, and Report Correctness

Goal: ensure every displayed count is derived from the correct production detection events and session lifecycle.

Tasks:

- For `COUNTING` receiving, derive actual only from its active `COUNTING` session.
- For `COMPLETED` receiving, derive actual only from `COMPLETED` sessions.
- Display actual as `null` for `DRAFT`, `WAITING`, and `CANCELLED` receiving.
- Exclude events belonging to `CANCELLED` sessions from later receiving actuals.
- Require `DETECTION`, `PRODUCTION`, and `ASSIGNED` filters for all actual-count queries.
- Fix receiving list/detail, reports, and dashboard calculations to use the same rules.
- Exclude cancelled receiving from today's manifest total.
- Add Admin dashboard `REVIEW_REQUIRED` count.
- Scope Operator waiting queue and detection statistics to the selected line.
- Use `received_at` as the authoritative server timestamp for operational statistics.
- Calculate daily boundaries in `SITE_TIMEZONE`, default `Asia/Jakarta`.

Acceptance criteria:

- Cancelled-session events never enter a restarted receiving actual.
- Heartbeat, test, and maintenance events never increase operational KPIs.
- Dashboard, receiving detail, and reports agree for completed receiving.
- Daily statistics use the site timezone even when the server runs in UTC.
- Waiting receiving displays `Belum dihitung`, not zero.

Validation:

```text
npm test
npm run typecheck
npm run build
```

## Batch 11: Authentication and Authorization Hardening

Goal: make database state authoritative for user status, roles, permissions, and Operator line access.

Tasks:

- Add nullable `users.assigned_line_id` referencing `lines`.
- Add a unique index on `(user_id, role_id)` in `user_roles`.
- Assign the seeded Operator to a development line.
- Reload the current user status and roles from the database on every protected API request.
- Treat roles in the signed cookie only as a navigation hint, never as backend authorization truth.
- Reject valid cookies belonging to inactive or deleted users.
- Apply role changes immediately without waiting for cookie expiry.
- Add a backend `requireRole('ADMIN')` guard.
- Require Admin for `/api/dashboard/admin`, `/admin/*`, and `/dev/sensor-simulator` in every environment.
- Restrict Operator APIs to their assigned line.
- Require `SESSION_SECRET` in production; allow fallback only in development/test.

Acceptance criteria:

- Operator cannot retrieve Admin dashboard data or another line's operational data.
- Inactive users and users whose role was revoked lose access immediately.
- Token role manipulation cannot grant backend permissions.
- Production cannot use the development session secret.

Validation:

```text
npm test -- src/test/auth.test.ts
npm run typecheck
npm run build
```

## Batch 12: Transactional Audit Logs

Goal: prevent important business mutations from committing without their required audit record.

Tasks:

- Make the audit helper throw when audit insertion fails instead of returning `null`.
- Put each business mutation and its audit record in the same transaction.
- Cover receiving create/update/publish/cancel and manifest revision.
- Cover session start/finish/cancel.
- Cover login `last_login_at` update and login audit.
- Store actor, role, before/after data, reason, source, and entity ID where relevant.
- Keep sensor events immutable instead of creating one audit row for every detection.

Acceptance criteria:

- No important receiving/session mutation commits without an audit record.
- Manifest revision, manifest update, and audit are atomic.
- Login does not update `last_login_at` when login audit insertion fails.
- Application APIs provide no audit update/delete operation.

Validation:

```text
npm test -- src/test/receiving.test.ts src/test/session.test.ts src/test/auth.test.ts
npm run typecheck
```

## Batch 13: Device API Hardening

Goal: make the ESP32 event contract strict, idempotent, and safe to retry.

Tasks:

- Limit `event_id` and `boot_id` to 1–100 characters.
- Accept sequence only as an integer from `0` through `2147483647`.
- Require a valid ISO-8601 `device_time` with timezone information.
- Limit one upload to 100 events.
- Add a database check constraint requiring non-negative sequence.
- Reject invalid timestamps instead of silently replacing them with server time.
- Keep one sequence stream for all event types within a boot.
- Preserve duplicate handling by `event_id` and `(device_id, boot_id, sequence)`.
- Return `INTERNAL_ERROR` for unexpected storage errors instead of a validation error.
- Make storage failure roll back the batch so the exact same events can be retried.
- Log frequent boot changes as diagnostics without rejecting a new boot in the MVP.

Acceptance criteria:

- Negative/overflow sequence, invalid timestamps, and oversized batches are rejected.
- Concurrent retries persist one physical event once.
- A new boot can safely restart sequence at zero.
- Storage failures cannot produce ambiguous partial counts.

Validation:

```text
npm test -- src/test/device.test.ts src/test/simulator.test.ts
npm run typecheck
npm run build
```

## Batch 14: Real WebSocket Realtime

Goal: replace the notification-only in-memory broadcaster with WebSocket connections consumed by the UI.

Tasks:

- Add the `ws` package and a custom Node server for Next.js.
- Expose an authenticated WebSocket endpoint at `/ws`.
- Authenticate the handshake with the session cookie and current database user state.
- Filter messages so Admin sees all lines and Operator sees only their assigned line.
- Connect route-handler broadcasts to authenticated WebSocket clients.
- Mount `WebSocketProvider` in authenticated dashboard layouts.
- Implement reconnect with backoff, authoritative refetch after reconnect, and polling fallback.
- Support session, counter, queue, sensor, device-status, and audit notifications.
- Document reverse-proxy HTTP Upgrade configuration.

Acceptance criteria:

- Two browsers observe counter updates without manual refresh.
- Critical state is refetched after reconnect.
- The application remains correct while WebSocket is unavailable.
- Operator never receives another line's message payload.

Validation:

```text
npm test
npm run typecheck
npm run build
```

## Batch 15: Device Health and Offline Detection

Goal: derive ONLINE, DEGRADED, and OFFLINE status from heartbeat timestamps and settings.

Tasks:

- Read degraded/offline thresholds from `app_settings`.
- Preserve `MAINTENANCE` as an operator override.
- Return `UNREGISTERED` before the first heartbeat.
- Derive ONLINE, DEGRADED, or OFFLINE from heartbeat age.
- Calculate effective status whenever device data is read.
- Add a server monitor that broadcasts only effective status changes.
- Preserve firmware version, RSSI, and diagnostic payload from heartbeat.
- Make `/api/device/config` return configured heartbeat and batch values.
- Make simulator offline mode visible on Admin and Operator dashboards.
- Display last heartbeat separately from last detection.

Acceptance criteria:

- Status changes automatically as heartbeat becomes stale.
- Maintenance is not overwritten by heartbeat.
- Effective status remains correct after application restart.
- Simulator offline mode reaches OFFLINE after the configured threshold.

Validation:

```text
npm test
npm run typecheck
npm run build
```

## Batch 16: Master Data CRUD

Goal: replace static Truck, Driver, and Supplier screens with audited Admin workflows.

Tasks:

- Implement Admin-only CRUD APIs for trucks, drivers, and suppliers.
- Validate license-plate and supplier-code uniqueness.
- Use ACTIVE/INACTIVE status instead of deleting referenced records.
- Make all mutations transactional and audited.
- Implement searchable/filterable tables and create/edit forms.
- Add loading, empty, error, and retry states.
- Preserve receiving snapshots when master data changes.

Acceptance criteria:

- Admin can create, edit, and deactivate all master-data types.
- Operator is rejected by every management API.
- Historical receiving snapshots never change with master data.
- Every mutation appears in the audit trail.

Validation:

```text
npm test
npm run typecheck
npm run build
```

## Batch 17: Lines and Devices Management

Goal: replace static Lines & Devices screens with secure management workflows.

Tasks:

- Implement Admin-only line and device management APIs.
- Support line create/edit/activate/deactivate/maintenance actions.
- Reject line deactivation or maintenance while counting is active.
- Support device registration, line assignment, maintenance, and credential rotation.
- Reject device reassignment while the relevant line has an active session.
- Generate device secrets cryptographically, show plaintext once, and store only the hash.
- Never return `credential_hash` through API or UI.
- Implement line/device tables, forms, status, heartbeat, firmware, RSSI, and secret dialogs.
- Make all mutations transactional and audited.

Acceptance criteria:

- A registered device works with its one-time secret.
- The previous secret stops working after rotation.
- Operator cannot manage lines or devices.
- Active counting prevents unsafe line/device changes.
- Credential hashes never leave the backend.

Validation:

```text
npm test
npm run typecheck
npm run build
```

## Batch 18: Users and Settings Management

Goal: replace static Users and Settings screens with guarded Admin workflows.

Tasks:

- Support user create, role assignment, Operator line assignment, password reset, activation, and deactivation.
- Require passwords of at least 12 characters and hash them with bcrypt.
- Prevent self-deactivation and removal/deactivation of the final active Admin.
- Require every Operator to have an assigned line.
- Support site name, timezone, heartbeat thresholds, polling fallback, and device batch size settings.
- Require degraded threshold to be lower than offline threshold.
- Make all mutations transactional and audited.
- Ensure role/status changes immediately affect protected APIs.

Acceptance criteria:

- Admin can manage users and settings through functional UI.
- New Operators only access their assigned line.
- The last active Admin is always protected.
- Updated settings are consumed by dashboards and device services.

Validation:

```text
npm test
npm run typecheck
npm run build
```

## Batch 19: Reports, Audit, and Final UI Polish

Goal: finish the incomplete Batch 8 operational screens and user states.

Tasks:

- Add report filters by date range and line.
- Add CSV export using the same corrected report calculations.
- Add audit filters for action, entity, actor, and date range.
- Add audit before/after detail without exposing credentials or secrets.
- Add loading, empty, error, retry, and double-submit protection across MVP pages.
- Verify responsive counting actions on tablet/mobile widths.
- Normalize remaining UI copy to Bahasa Indonesia.
- Show stale/offline sensor warnings near finish actions.

Acceptance criteria:

- Report UI and CSV contain the same values.
- Audit can trace a receiving from creation through finish.
- No primary Admin screen still depends on mock/static data.
- Critical actions cannot be submitted twice accidentally.

Validation:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

## Batch 20: PostgreSQL Integration and Deployment Safety

Goal: validate real PostgreSQL behavior without risking operational data.

Tasks:

- Verify the currently connected VPS test database and formalize it with a dedicated database/user whose database name ends in `_test`; create a replacement only if the existing database does not satisfy that guard.
- Add `DATABASE_TEST_URL` and a serial `test:pg` configuration.
- Refuse destructive integration setup unless the target database ends in `_test`.
- Run migration, seed, and concurrency integration tests only against that test database.
- Ensure PostgreSQL concurrency scenarios from previous batches (e.g., session transitions and receiving mutations) are explicitly verified in integration tests.
- Add `/api/health` checks for app, database, migration state, WebSocket, and version.
- Bind PostgreSQL Compose port only to the Tailscale address or internal Docker network.
- Add restart policy, persistent volume, and healthcheck to deployment Compose.
- Document backup, restore, migration, rollback, and smoke-test procedures.

Acceptance criteria:

- PostgreSQL concurrency tests pass on the VPS test database.
- The test guard rejects production/development database names.
- PostgreSQL is not reachable through the VPS public interface.
- Health endpoint reports database or WebSocket failure.
- A backup can be restored into an empty database.

Validation:

```text
npm run test:pg
npm run lint
npm run typecheck
npm test
npm run build
```

## Batch 21: ESP32 Protocol and Pilot Readiness

Implementation status: **SELESAI (SOFTWARE)**. Kontrak backend, dokumentasi protocol,
checklist pilot, dan firmware simulator ESP32-S3 tanpa sensor telah tersedia. Status ini
tidak menyatakan field test sensor fisik lulus; lihat `docs/PROJECT_STATUS.md` dan
`docs/ESP32_FIELD_TEST_RESULTS.md`.

Goal: finalize the firmware contract and field-test checklist without changing backend counting rules again.

Tasks:

- Add `docs/ESP32_PROTOCOL.md`.
- Generate one UUID `boot_id` per MCU boot and keep it stable in RAM for that boot.
- Start one shared sequence stream at zero for all event types.
- Never generate a new boot ID on reconnect or retry.
- Retry the exact same event identity and timestamp until acknowledged.
- Keep unsent events in a RAM queue and remove them only after server ACK.
- Respect batch size from `/api/device/config` and use exponential retry backoff.
- Document that unsent RAM events can be lost on sudden power failure.
- Document that timestamps are not uniqueness keys and detections during total power loss cannot be reconstructed.
- Add field checks for normal counting, network loss, API timeout, duplicate retry, MCU/server restart, finish boundary, offline heartbeat, and Truck A-to-B transition.

Acceptance criteria:

- MCU reboot produces a new boot ID with sequence zero.
- Network retry never duplicates actual count.
- Queued events are accepted once after reconnect.
- Events arriving after finish become `UNASSIGNED`.
- The full pilot flow works without database access or manual actual editing.

Validation:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

## Remediation Execution Order

Implement only one batch per agent task:

```text
Batch 9  -> Session integrity
Batch 10 -> Count correctness
Batch 11 -> Auth hardening
Batch 12 -> Transactional audit
Batch 13 -> Device API hardening
Batch 14 -> Real WebSocket
Batch 15 -> Device health
Batch 16 -> Master data
Batch 17 -> Lines and devices
Batch 18 -> Users and settings
Batch 19 -> Reports and UI polish
Batch 20 -> PostgreSQL and deployment
Batch 21 -> ESP32 pilot contract
```

Batch 9–13 block real ESP32 integration. Batch 14–15 block a live operational demo. Batch 16–19 complete the MVP management surfaces. Batch 20–21 block a production pilot.

## Core Test Scenarios

Implement tests across the relevant batches:

1. Detection without active session becomes `UNASSIGNED`.
2. Detection with active session becomes `ASSIGNED`.
3. Duplicate detection with the same device, boot, and sequence counts once.
4. One line cannot have two active sessions.
5. Two concurrent starts only create one active session.
6. Event from Line 2 cannot enter Line 1 session.
7. Manifest does not auto-finish session.
8. Actual may be less than manifest.
9. Actual may be greater than manifest.
10. Operator cannot edit actual.
11. Operator cannot access Admin APIs.
12. Manifest revision stores old value.
13. Waiting receiving actual is empty/not counted.
14. Final difference uses completed sessions only.
15. Detection Today equals Assigned Today plus Unassigned Today.
16. Start and Finish create audit logs.
17. Sensor simulator uses Device API.
18. Device retry does not duplicate count.
19. Sequence may restart from zero after a new device boot.
20. One receiving cannot have two active sessions across different lines.
21. Concurrent finish/cancel has exactly one winner.
22. Event assignment and finish are serialized on the line boundary.

## Final MVP Demo Flow

The app should support this demo:

```text
Admin login
-> input surat jalan
-> publish receiving to waiting queue
-> Operator/Admin start counting
-> simulator sends detections
-> actual updates realtime
-> Operator/Admin finish counting
-> system shows manifest vs actual
-> audit trail records the flow
```
