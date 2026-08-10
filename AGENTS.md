# Agent Instructions

This repository contains the active implementation of the Poultry Receiving Counter System.

Before making code changes, every AI agent must read these files in order:

1. `docs/PRODUCT_SPEC.md`
2. `docs/TECH_STACK.md`
3. `docs/UI_STRUCTURE.md`
4. `docs/DATA_MODEL.md`
5. `docs/API_CONTRACT.md`
6. `docs/IMPLEMENTATION_TASKS.md`
7. `docs/DEPLOYMENT.md`
8. `docs/PROJECT_STATUS.md`

## Product Rules

- Build the MVP with only two roles: `OPERATOR` and `ADMIN`.
- Admin has all permissions, including start and finish counting.
- Do not implement Supervisor as a separate role in the MVP.
- Do not implement QR workflow.
- Do not implement physical button workflow.
- Do not implement hardware batch switch.
- Do not use Supabase services for the MVP.
- Use PostgreSQL via `DATABASE_URL`.
- Development database must run through Docker Compose.
- Actual count must always be derived from immutable `sensor_events`.
- Never let users edit actual count directly.
- Detection outside an active session must become `UNASSIGNED`.
- Batch change is operational: finish Truck A, stop, confirm, then start Truck B.
- The sensor is located after weighing and hanging, before slaughter.

## Engineering Rules

- Follow the implementation batches in `docs/IMPLEMENTATION_TASKS.md`.
- Complete only the requested batch unless explicitly asked to continue.
- Keep changes small, focused, and consistent with the existing docs.
- Add tests for business invariants before broad UI polish.
- Prefer simple, explicit code over premature abstraction.
- Use shared components for counting flows so Operator can be removed later without rewriting core logic.
- Backend authorization is mandatory; hiding UI buttons is not enough.
- Keep UI copy in Bahasa Indonesia.

## Stack Rules

- Use Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, lucide-react, Drizzle ORM, Zod, PostgreSQL, WebSocket, Vitest, and npm.
- Use local session-based authentication with secure HttpOnly cookies.
- Use Docker Compose for local PostgreSQL and VPS deployment.
- Use CSS variables/design tokens for theme values.

## Validation Expectations

For implementation work, run the most specific validation available for the changed area, then broader checks when practical:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

If a command is not available yet, document that clearly in the final response.
