# Tech Stack

## Final Stack

Use this stack for the MVP:

```text
Framework        : Next.js App Router
UI library       : React
Language         : TypeScript strict
Styling          : Tailwind CSS
UI components    : shadcn/ui
Icons            : lucide-react
Database         : PostgreSQL
Development DB   : Docker Compose on VPS
Private DB access: Tailscale
ORM              : Drizzle ORM
Validation       : Zod
Auth             : Local session auth
Realtime         : WebSocket
Tests            : Vitest
Package manager  : npm
Deployment       : Docker Compose on VPS
```

## Architecture

Use a single fullstack Next.js repository for the MVP.

```text
Browser UI
  -> Next.js App Router pages
  -> Next.js route handlers / server actions
  -> Domain services
  -> Drizzle ORM
  -> PostgreSQL
```

ESP32 devices send events to the same application through device API endpoints.

## Project Structure

Recommended structure:

```text
src/
  app/
    (auth)/
    (operator)/
    (admin)/
    api/
  components/
    layout/
    counting/
    dashboard/
    receiving/
    sensor/
    ui/
  db/
    schema/
    migrations/
    seed/
    index.ts
  domain/
    auth/
    receiving/
    sessions/
    sensor-events/
    dashboard/
    audit/
  lib/
    env.ts
    errors.ts
    permissions.ts
    time.ts
    websocket.ts
  server/
    auth/
    db/
    realtime/
    device-auth/
  test/
    factories/
    integration/
    unit/
drizzle/
docs/
public/
```

The exact folder names may be adjusted by the implementer if the same boundaries are preserved.

## UI System

Use shadcn/ui as the base component system. Components should be copied into the repository and customized with Tailwind and CSS variables.

Use lucide-react icons for menu items, action buttons, status indicators, and empty states.

Use Bahasa Indonesia for UI labels, table headers, dialogs, validation messages, and operational prompts.

## Theme Direction

- Main workspace: white and light gray.
- Primary action: purple.
- Sidebar: purple to pink to peach/orange gradient.
- Success: green.
- Warning: orange.
- Danger/anomaly: red.
- Idle/neutral: gray.
- Cards: rounded, subtle border, soft shadow.
- Tables: clean, scannable, compact enough for operations.

Use CSS variables/design tokens so colors can be changed later without rewriting components.

## Auth

Implement local email/password authentication.

Requirements:

- Passwords must be hashed.
- Sessions must use secure HttpOnly cookies.
- Backend must enforce role and permission checks.
- Device credentials must be separate from user credentials.
- The app must work without external auth providers.

Development users:

```text
operator@local.test
Role: OPERATOR

admin@local.test
Role: ADMIN
```

Document development passwords in the README during implementation and mark them as non-production credentials.

## Realtime

Use WebSocket for MVP realtime updates.

Minimum realtime channels/events:

- Active session counter updates.
- Sensor activity updates.
- Device status updates.
- Receiving queue updates after start/finish/cancel.

The backend remains the source of truth. WebSocket messages are notifications, not authoritative writes.

## Database

Use PostgreSQL through `DATABASE_URL`.

The current development database runs as a PostgreSQL Docker Compose service on the VPS. Developer laptops connect to it through Tailscale; PostgreSQL does not need to be installed or started locally.

Use separate database names and credentials for development, test, staging, and production. Tests and seed commands must never target the production database.

PostgreSQL port access must be restricted to the Tailscale network or the internal Docker network. Do not expose port `5432` to the public internet.

Use Drizzle migrations for schema changes.

## Validation

Use Zod for:

- API request body validation.
- Query parameter validation.
- Device payload validation.
- Environment variable validation.

Use consistent API errors rather than ad hoc strings.

## Testing

Use Vitest for domain logic and API-level tests where practical.

Prioritize tests for:

- Session start/finish invariants.
- Detection assignment.
- Duplicate event handling.
- Role permissions.
- Dashboard calculations.
- Audit creation.

## Package Manager

Use npm for maximum compatibility with AI agents, Windows, local development, CI, and VPS deployment.
