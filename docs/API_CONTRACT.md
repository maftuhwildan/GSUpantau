# API Contract

## General Rules

- All application APIs must validate input with Zod.
- All protected APIs must check authentication and permission on the backend.
- All timestamps should be stored in UTC and displayed in site timezone.
- API responses should use a consistent error shape.
- Device APIs use device credentials, not user sessions.

## Error Shape

Use this shape for errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input tidak valid.",
    "details": {}
  }
}
```

Recommended codes:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
DUPLICATE_EVENT
SESSION_ALREADY_ACTIVE
NO_ACTIVE_SESSION
INVALID_STATUS
DEVICE_UNREGISTERED
DEVICE_LINE_MISMATCH
INTERNAL_ERROR
```

## Auth API

### POST `/api/auth/login`

Body:

```json
{
  "email": "admin@local.test",
  "password": "password"
}
```

Response:

```json
{
  "user": {
    "id": "uuid",
    "email": "admin@local.test",
    "name": "Admin",
    "roles": ["ADMIN"],
    "permissions": ["dashboard:view"]
  }
}
```

Rules:

- Create HttpOnly session cookie.
- Write login audit log.

### POST `/api/auth/logout`

Clears the session cookie.

### GET `/api/auth/session`

Returns current authenticated user and permissions.

## Receiving API

### GET `/api/receivings`

Query:

```text
status optional
line_id optional
date_from optional
date_to optional
search optional
```

Permissions:

```text
receiving:view
```

### POST `/api/receivings`

Permissions:

```text
receiving:create
```

Body:

```json
{
  "receiving_date": "2026-08-07",
  "delivery_note_number": "SJ-2026-0807-001",
  "document_truck_sequence": 1,
  "queue_position": 1,
  "truck_id": "uuid",
  "license_plate_snapshot": "B 1234 XYZ",
  "driver_id": "uuid",
  "driver_name_snapshot": "Ahmad",
  "supplier_id": "uuid",
  "supplier_name_snapshot": "Farm Maju",
  "manifest_count": 5000,
  "line_id": "uuid",
  "notes": "Catatan opsional"
}
```

Response:

```json
{
  "receiving": {
    "id": "uuid",
    "status": "DRAFT"
  }
}
```

Rules:

- Create receiving as `DRAFT`.
- Write audit log.

### GET `/api/receivings/:id`

Permissions:

```text
receiving:view
```

Returns detail, current derived actual if relevant, sessions, manifest revisions, and audit summary.

### PATCH `/api/receivings/:id`

Permissions:

```text
receiving:update
```

Body:

```json
{
  "manifest_count": 4980,
  "line_id": "uuid",
  "notes": "Koreksi surat jalan",
  "reason": "Manifest pada surat jalan dikoreksi"
}
```

Rules:

- `DRAFT` can be updated by Admin.
- `WAITING` manifest changes require `reason`, manifest revision, and audit log.
- `COUNTING` and `COMPLETED` manifest cannot be changed in MVP.

### POST `/api/receivings/:id/publish`

Permissions:

```text
receiving:publish
```

Rules:

- Move `DRAFT` to `WAITING`.
- Validate required fields.
- Write audit log.

### POST `/api/receivings/:id/cancel`

Permissions:

```text
receiving:cancel
```

Body:

```json
{
  "reason": "Truck batal diproses"
}
```

Rules:

- Cancel only when safe according to current status.
- Write audit log.

## Session API

### POST `/api/sessions/start`

Permissions:

```text
session:start
```

Body:

```json
{
  "receiving_id": "uuid",
  "line_id": "uuid"
}
```

Rules:

- Only `WAITING` receiving can be started.
- One line can have only one active `COUNTING` session.
- One receiving can have only one active `COUNTING` session across all lines.
- A provided `line_id` must match the receiving line when one is already assigned.
- The target line must exist and have status `ACTIVE`.
- Start must run in a transaction.
- Concurrent start requests have exactly one winner; losing requests return HTTP `409`.
- Create session.
- Update receiving to `COUNTING`.
- Write audit log.
- Broadcast WebSocket update.

Response:

```json
{
  "session": {
    "id": "uuid",
    "receiving_id": "uuid",
    "line_id": "uuid",
    "status": "COUNTING",
    "started_at": "2026-08-07T03:00:00.000Z"
  }
}
```

### POST `/api/sessions/:id/finish`

Permissions:

```text
session:finish
```

Body:

```json
{
  "confirmation": true
}
```

Rules:

- Requires active `COUNTING` session.
- Finish must run in a transaction.
- Finish serializes against sensor assignment on the same line.
- Concurrent finish/cancel requests have exactly one winner.
- Update session to `COMPLETED`.
- Update receiving to `COMPLETED`.
- Calculate derived actual for response.
- Write audit log.
- Broadcast WebSocket update.

Response:

```json
{
  "session": {
    "id": "uuid",
    "status": "COMPLETED",
    "actual_count": 4998,
    "difference_count": -2,
    "difference_percent": -0.04
  }
}
```

### POST `/api/sessions/:id/cancel`

Permissions:

```text
session:cancel
```

Body:

```json
{
  "reason": "Kesalahan pemilihan truck"
}
```

Rules:

- Requires reason.
- Cancel serializes against finish and sensor assignment on the same line.
- A cancelled session keeps its immutable sensor events and returns the receiving to `WAITING`.
- Write audit log.
- Broadcast WebSocket update.

### GET `/api/lines/:id/active-session`

Permissions:

```text
dashboard:view
```

Returns active session, receiving detail, actual count, difference, sensor status, and last detection.

## Device API

Device APIs must authenticate with device credentials.

Recommended header:

```text
Authorization: Bearer <device-secret>
```

### POST `/api/device/events`

Accepts one or more device events.

Body:

```json
{
  "device_id": "ESP32-LINE-01",
  "line_id": "LINE-01",
  "events": [
    {
      "event_id": "ESP32-LINE-01:550e8400-e29b-41d4-a716-446655440000:1001",
      "boot_id": "550e8400-e29b-41d4-a716-446655440000",
      "sequence": 1001,
      "event_type": "DETECTION",
      "device_time": "2026-08-07T10:15:32.441+07:00",
      "event_mode": "PRODUCTION"
    }
  ]
}
```

Rules:

- Validate known device.
- Validate device belongs to line.
- Insert events idempotently.
- `event_id` duplicate must not increment actual.
- `(device_id, boot_id, sequence)` duplicate must not increment actual, even if retry timestamp changes.
- A new `boot_id` may restart `sequence` from zero after device reboot.
- `device_time` must not be used as an event uniqueness key.
- `DETECTION` during active session becomes `ASSIGNED`.
- `DETECTION` without active session becomes `UNASSIGNED`.
- Assignment is determined while holding the same line lock used by session start/finish/cancel.
- Events committed before finish are included in final actual; events committed after finish are `UNASSIGNED`.
- `HEARTBEAT` and `DEVICE_RESTART` do not increment actual.
- Preserve raw payload.
- Broadcast updates for active session counter and sensor activity.
- Broadcast only after the database transaction commits.

Response:

```json
{
  "accepted": 1,
  "duplicates": 0,
  "rejected": 0,
  "events": [
    {
      "event_id": "ESP32-LINE-01:550e8400-e29b-41d4-a716-446655440000:1001",
      "boot_id": "550e8400-e29b-41d4-a716-446655440000",
      "sequence": 1001,
      "status": "ACCEPTED",
      "assignment_status": "ASSIGNED",
      "session_id": "uuid"
    }
  ]
}
```

### POST `/api/device/heartbeat`

Body:

```json
{
  "device_id": "ESP32-LINE-01",
  "line_id": "LINE-01",
  "firmware_version": "1.0.0",
  "wifi_rssi": -61,
  "diagnostic_payload": {
    "free_heap": 120000
  }
}
```

Rules:

- Update last heartbeat.
- Update diagnostic metadata.
- Broadcast device status.

### GET `/api/device/config`

Returns config for authenticated device.

Response:

```json
{
  "device_id": "ESP32-LINE-01",
  "line_id": "LINE-01",
  "server_time": "2026-08-07T03:00:00.000Z",
  "heartbeat_interval_seconds": 10,
  "batch_upload_max_events": 100
}
```

## Dashboard API

### GET `/api/dashboard/operator`

Permissions:

```text
dashboard:view
```

Returns assigned line dashboard data.

### GET `/api/dashboard/admin`

Permissions:

```text
dashboard:view
```

Returns all-line admin dashboard data.

## Sensor Activity API

### GET `/api/sensor-events`

Permissions:

```text
sensor:view
```

Query:

```text
line_id optional
device_id optional
event_type optional
assignment_status optional
date_from optional
date_to optional
limit optional
cursor optional
```

Rules:

- Return paginated events.
- Do not expose raw device credential data.

## Master Data API

Use conventional CRUD endpoints for Admin-only management:

```text
/api/trucks
/api/drivers
/api/suppliers
/api/lines
/api/devices
/api/users
/api/settings
```

Permissions:

```text
master_data:manage
lines_devices:manage
users:manage
settings:manage
```

## WebSocket Events

Use WebSocket for realtime notifications.

Recommended server-to-client event names:

```text
session.started
session.counter_updated
session.finished
session.cancelled
receiving.queue_updated
sensor.event_received
device.status_updated
audit.created
```

Message shape:

```json
{
  "type": "session.counter_updated",
  "occurred_at": "2026-08-07T03:00:00.000Z",
  "payload": {
    "session_id": "uuid",
    "line_id": "uuid",
    "actual_count": 1234
  }
}
```

Rules:

- WebSocket messages are not authoritative writes.
- UI must refetch critical state after reconnect.
- Backend must remain correct even if WebSocket is disconnected.
