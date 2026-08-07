# Data Model

## Principles

- `sensor_events` are the source of truth for actual count.
- Actual count is derived, not edited.
- Raw sensor events must be immutable through normal application APIs.
- One line can have at most one active `COUNTING` session.
- Receiving lifecycle and reconciliation lifecycle are separate.
- Master data changes must not rewrite historical receiving records.
- Important changes must create audit logs.

## Tables

MVP tables:

```text
users
roles
user_roles
trucks
drivers
suppliers
lines
devices
receivings
manifest_revisions
receiving_sessions
sensor_events
reconciliation_reviews
audit_logs
app_settings
```

Use UUID or ULID primary keys for application identifiers.

Use timestamps with UTC storage.

Display dates/times in site timezone, default `Asia/Jakarta`.

## Roles

Role codes:

```text
OPERATOR
ADMIN
```

Admin has every MVP permission, including counting.

## Permissions

Recommended permission model:

```text
dashboard:view
receiving:view
receiving:create
receiving:update
receiving:publish
receiving:cancel
session:start
session:finish
session:cancel
sensor:view
master_data:manage
lines_devices:manage
users:manage
settings:manage
reports:view
audit:view
```

Operator:

```text
dashboard:view
receiving:view
session:start
session:finish
sensor:view
```

Admin:

```text
all permissions
```

## Receiving

Represents one truck or batch from a delivery note.

Fields:

```text
id
receiving_number
delivery_note_number
receiving_date
document_truck_sequence nullable
queue_position
truck_id nullable
license_plate_snapshot
driver_id nullable
driver_name_snapshot
supplier_id nullable
supplier_name_snapshot
manifest_count
line_id nullable
status
reconciliation_status
notes nullable
created_by
published_at nullable
created_at
updated_at
```

Constraints:

- `manifest_count` must be positive integer.
- `status` must be one of `DRAFT`, `WAITING`, `COUNTING`, `COMPLETED`, `CANCELLED`.
- `reconciliation_status` must be separate from `status`.
- Waiting queue sorting should use `queue_position`, then `created_at`.

Rules:

- `DRAFT` can be edited by Admin.
- `WAITING` can be edited by Admin with reason and audit for manifest changes.
- `COUNTING` and `COMPLETED` manifest cannot be changed in MVP.
- Historical snapshots must remain unchanged even if truck, driver, or supplier master data changes.

## Manifest Revisions

Stores manifest count changes.

Fields:

```text
id
receiving_id
old_manifest_count
new_manifest_count
reason
changed_by
changed_at
created_at
```

Rules:

- Required when a published `WAITING` receiving manifest changes.
- Must preserve old and new values.
- Must create audit log.

## Receiving Sessions

Represents one counting window.

Fields:

```text
id
receiving_id
line_id
status
started_at
started_by
finished_at nullable
finished_by nullable
cancelled_at nullable
cancelled_by nullable
cancellation_reason nullable
created_at
updated_at
```

Do not add editable `actual_count`.

If a cached count is added later, it must be marked derived and reconstructable from `sensor_events`.

Constraints:

- One active `COUNTING` session per line.
- `receiving_id` should not have multiple active sessions.
- Session line must match receiving line when receiving line is set.

PostgreSQL partial unique index:

```sql
CREATE UNIQUE INDEX one_active_session_per_line
ON receiving_sessions (line_id)
WHERE status = 'COUNTING';
```

Rules:

- Only `WAITING` receiving can be started.
- Start session must be transactional.
- Starting a session changes receiving status to `COUNTING`.
- Finishing a session changes session status to `COMPLETED` and receiving status to `COMPLETED`.
- Finish session must be transactional.
- Cancel actions require reason and audit.

## Sensor Events

Represents raw events received from ESP32 devices.

Fields:

```text
id
event_id
device_id
line_id
sequence
event_type
device_time
received_at
session_id nullable
assignment_status
event_mode
raw_payload jsonb
created_at
```

Event types:

```text
DETECTION
HEARTBEAT
DEVICE_RESTART
```

Assignment statuses:

```text
ASSIGNED
UNASSIGNED
```

Event modes:

```text
PRODUCTION
TEST
MAINTENANCE
```

Constraints:

```text
event_id UNIQUE
(device_id, sequence) UNIQUE
```

Rules:

- Duplicate event must not increase actual count.
- Detection event on a line with active session becomes `ASSIGNED`.
- Detection event on a line with no active session becomes `UNASSIGNED`.
- Heartbeat and restart events do not increase actual count.
- Device line must match event line.
- Raw payload must be preserved.
- Application UI must not delete raw events.

## Devices

Represents ESP32 devices.

Fields:

```text
id
device_code
line_id
name
credential_hash
status
last_heartbeat_at nullable
ip_address nullable
firmware_version nullable
wifi_rssi nullable
diagnostic_payload jsonb nullable
created_at
updated_at
```

Device statuses:

```text
ONLINE
DEGRADED
OFFLINE
MAINTENANCE
UNREGISTERED
```

Rules:

- Device credentials are separate from user credentials.
- Store credential hashes, not plaintext secrets.
- Heartbeat threshold must be configurable.

## Lines

Represents a physical counting line.

Fields:

```text
id
line_code
name
status
created_at
updated_at
```

Line statuses:

```text
ACTIVE
INACTIVE
MAINTENANCE
```

## Master Data

Tables:

```text
trucks
drivers
suppliers
```

Use active/inactive flags instead of deleting records used by receiving history.

Receiving must store snapshots:

```text
license_plate_snapshot
driver_name_snapshot
supplier_name_snapshot
```

## Audit Logs

Fields:

```text
id
actor_id nullable
actor_role nullable
action
entity_type
entity_id
before_data jsonb nullable
after_data jsonb nullable
reason nullable
source
request_id nullable
created_at
```

Rules:

- Append-only through application APIs.
- Required for start, finish, cancel, manifest revision, master data changes, user changes, device changes, settings changes.
- Include reason when the action changes important business data.

## Reconciliation Reviews

MVP can keep this simple.

Fields:

```text
id
receiving_id
session_id
status
difference_count
difference_percent nullable
review_notes nullable
reviewed_by nullable
reviewed_at nullable
created_at
updated_at
```

Statuses:

```text
PENDING
MATCHED
REVIEW_REQUIRED
UNDER_REVIEW
RECONCILED
REJECTED
```

## App Settings

Fields:

```text
id
key
value jsonb
updated_by nullable
updated_at
created_at
```

Initial settings:

```text
site_timezone = Asia/Jakarta
heartbeat_offline_threshold_seconds = 30
heartbeat_degraded_threshold_seconds = 15
site_name = Poultry Receiving Counter System
```

## Dashboard Calculations

Actual count:

```sql
COUNT(sensor_events.id)
WHERE event_type = 'DETECTION'
  AND event_mode = 'PRODUCTION'
  AND assignment_status = 'ASSIGNED'
  AND session_id = ?
```

Difference:

```text
actual_count - manifest_count
```

Difference percentage:

```text
(actual_count - manifest_count) / manifest_count * 100
```

Final difference should use completed sessions only.

Waiting receiving actual should display `null`, `-`, or `Belum dihitung`, not zero.

## Critical Invariants

1. One line has at most one active `COUNTING` session.
2. Only `WAITING` receiving can be started.
3. Completed receiving cannot be started again in MVP.
4. Finish requires an active session.
5. Event can only be assigned to a session on the same line.
6. Duplicate event does not increase actual count.
7. Actual count is not editable through API.
8. Start and finish must be transactional.
9. Raw sensor event is immutable through normal app APIs.
10. Important changes must write audit logs.
