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

## Batch 2: Database, Drizzle, Docker Compose, Seed

Goal: create PostgreSQL development database and schema.

Tasks:

- Add Docker Compose PostgreSQL service.
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

- `docker compose up -d` starts PostgreSQL.
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

## Core Test Scenarios

Implement tests across the relevant batches:

1. Detection without active session becomes `UNASSIGNED`.
2. Detection with active session becomes `ASSIGNED`.
3. Duplicate detection counts once.
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
