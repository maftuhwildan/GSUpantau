# Product Spec

## Overview

Poultry Receiving Counter System is a web application for a Rumah Potong Ayam (RPA). The system compares the number of chickens from a delivery note manifest with the actual count detected by a sensor for each truck or batch.

The goal is to support reconciliation, reduce manipulation risk, expose variance, preserve audit history, and monitor sensor activity.

## Final MVP Decisions

- No QR code workflow.
- No physical button workflow.
- No hardware batch switch.
- Batch changes are handled by stopping the process first.
- Truck A must be finished and confirmed before Truck B is started.
- The sensor is located after weighing and hanging, before slaughter.
- The sensor detects chicken passage only as `+1`.
- The sensor does not know the truck or batch source.
- Actual count is derived from sensor events, not manual input.
- Data from delivery notes is entered manually by Admin.
- The system must support multiple lines by design.
- One line may only have one active counting session at a time.

## Core Concept

One `Receiving` represents one truck or batch from a delivery note.

One `ReceivingSession` represents one active counting window for one line.

All detection events received while a line has an active session are assigned to that session. Detection events received while no session is active are stored as `UNASSIGNED`.

## Operational Workflow

1. Admin receives a delivery note.
2. Admin creates a receiving draft.
3. Admin fills delivery note number, truck data, driver, supplier, manifest count, line, and notes.
4. Admin publishes the receiving to `WAITING`.
5. Operator or Admin opens the queue.
6. Operator or Admin selects one waiting receiving and starts counting.
7. The receiving and session become `COUNTING`.
8. ESP32 keeps sending sensor detections through the device API.
9. Actual count updates in realtime from assigned sensor events.
10. When Truck A is finished, the field process stops.
11. Operator or Admin confirms Truck A is finished.
12. The session becomes `COMPLETED`; the line becomes idle.
13. Operator or Admin starts Truck B only after Truck A is completed.

## SOP Boundary Rule

The batch boundary is operational, not hardware-based.

Correct flow:

```text
Truck A COUNTING
-> Truck A habis
-> proses berhenti
-> Operator/Admin FINISH COUNTING
-> line IDLE
-> Operator/Admin START COUNTING Truck B
-> Truck B COUNTING
```

The app must warn users before finish:

```text
Pastikan truck ini sudah habis dan proses line sudah berhenti sebelum menyelesaikan counting.
```

If detection occurs after finish and before the next start, it must be saved as `UNASSIGNED`.

## Roles

### Operator

Operator focuses on daily counting operations.

Allowed:

- View assigned line dashboard.
- View receiving queue.
- Start counting.
- Finish counting.
- View active session.
- View sensor activity for operational context.
- View unassigned detection summary.

Not allowed:

- Create or edit receiving manifest.
- Edit actual count.
- Manage master data.
- Manage lines or devices.
- Manage users.
- Change settings.
- Delete sensor events.
- Delete audit logs.

### Admin

Admin has full MVP access, including operational counting.

Allowed:

- All Operator actions.
- Create, edit, publish, and cancel receiving data.
- Manage trucks, drivers, suppliers.
- Manage lines and devices.
- Manage users and roles.
- Change settings.
- View reports.
- View audit trail.
- View all line and sensor activity.

## Statuses

Receiving lifecycle:

```text
DRAFT
WAITING
COUNTING
COMPLETED
CANCELLED
```

Session lifecycle:

```text
COUNTING
COMPLETED
CANCELLED
```

Reconciliation lifecycle:

```text
PENDING
MATCHED
REVIEW_REQUIRED
UNDER_REVIEW
RECONCILED
REJECTED
```

Reconciliation status is separate from receiving/session lifecycle.

## Counters

Actual count must be derived by counting production `DETECTION` events assigned to a session.

Core counters:

- Session Actual: assigned detection count for one session.
- Lifetime Detection: all accepted production detections.
- Detection Today: accepted production detections in site timezone.
- Assigned Detection: detections with `session_id`.
- Unassigned Detection: detections without `session_id`.

Cross-check:

```text
Detection Today = Assigned Detection Today + Unassigned Detection Today
```

## Variance

Use this formula:

```text
Difference = Actual - Manifest
Difference % = Difference / Manifest * 100
```

Interpretation:

- Negative means actual is lower than manifest.
- Positive means actual is higher than manifest.
- Zero means actual equals manifest.

If manifest is zero, percentage must be `null` or displayed as `N/A`.

The MVP must not auto-finish a session when actual equals manifest.

## Audit Requirements

Audit log must be append-only from the application perspective.

Audit these actions at minimum:

- Login.
- Create receiving.
- Update receiving.
- Publish receiving.
- Cancel receiving.
- Manifest revision.
- Start session.
- Finish session.
- Cancel session.
- Sensor event ingestion failure where useful.
- Master data changes.
- Line/device changes.
- User/role changes.
- Settings changes.

## Explicitly Out Of Scope For MVP

- QR scanning.
- Physical button batch switching.
- Automatic hardware boundary event.
- Pause counting.
- Supabase Auth, Supabase Realtime, or Supabase database dependency.
- Supervisor role as a separate UI role.
- Manual actual count editing.
- Complex approval workflow.
- ERP integration.
- Advanced anomaly detection.
