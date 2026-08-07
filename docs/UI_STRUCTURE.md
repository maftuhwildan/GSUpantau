# UI Structure

## Design Goal

The UI should feel like a modern, clean SaaS dashboard for operations. It must be easy for RPA staff to scan quickly during receiving/counting work.

The MVP UI language is Bahasa Indonesia.

## Layout

Use one reusable dashboard shell:

```text
DashboardShell
  Sidebar
  Header
  Main content
  Toast/notification area
```

Operator and Admin can have different menu items, but they should share layout primitives and operational components.

## Shared Components

Build these as reusable components:

- `CountingConsole`: active session, manifest, actual realtime, difference, finish action.
- `ReceivingQueueTable`: waiting/counting/completed/cancelled receiving rows.
- `SensorStatusBadge`: online/degraded/offline/maintenance/unregistered.
- `DifferenceBadge`: negative, positive, zero, review needed.
- `KpiCard`: dashboard metric card.
- `AuditTimeline`: recent audit events.
- `SensorActivityTable`: latest sensor events.
- `FinishCountingDialog`: finish confirmation with operational warning.
- `StartCountingDialog`: start confirmation with truck and line details.

`CountingConsole` must be shared by Operator and Admin so Operator can be removed later without rewriting core counting UI.

## Operator Menus

### Dashboard

Purpose: quick view of current operational state for assigned line.

Content:

- Line status.
- Active session summary.
- Current receiving/truck details.
- Manifest count.
- Actual count realtime.
- Temporary difference.
- Sensor online/offline state.
- Last heartbeat.
- Last detection time.
- Waiting queue summary.
- Unassigned detection today.

Primary actions:

- Open active session.
- Start next waiting receiving.
- Finish active session.

### Receiving Queue

Purpose: select the next truck/batch to count.

Content:

- List of `WAITING` receiving items.
- Current `COUNTING` item if any.
- Basic receiving details:
  - receiving number;
  - delivery note number;
  - queue position;
  - license plate;
  - driver;
  - supplier;
  - manifest count;
  - line;
  - status.

Actions:

- Start Counting.
- View detail.

Rules:

- Operator cannot edit manifest.
- Operator cannot create receiving data.
- Start must show confirmation with truck, line, delivery note, and manifest.

### Active Session

Purpose: operate the current session safely.

Content:

- Active truck/batch.
- Delivery note number.
- License plate.
- Driver.
- Supplier.
- Manifest.
- Actual realtime.
- Difference and percentage.
- Started at/by.
- Duration.
- Sensor status.
- Last detection time.
- Recent detections.
- Unassigned warning if detection occurred near session boundary.

Actions:

- Finish Counting.

Finish confirmation text:

```text
Pastikan truck ini sudah habis dan proses line sudah berhenti sebelum menyelesaikan counting.
```

### Sensor Activity

Purpose: inspect recent device activity.

Content:

- Recent sensor events.
- Assigned/unassigned status.
- Device.
- Line.
- Sequence.
- Event type.
- Device time.
- Received time.
- Related session/receiving.
- Heartbeat status.

Actions:

- Filter by line.
- Filter by event type.
- Filter by assigned/unassigned.

## Admin Menus

### Dashboard

Purpose: full operational and administrative overview.

Content:

- Total manifest today.
- Actual completed today.
- Final difference.
- Completed truck count.
- Active lines.
- Waiting queue count.
- Review required count.
- Unassigned detection today.
- Sensor health by line.
- Recent receiving activity.
- Recent audit activity.

Primary actions:

- Input Surat Jalan.
- Open Counting.
- Open Sensor Activity.

### Counting

Purpose: allow Admin to run the same counting workflow as Operator.

Content:

- Same `CountingConsole` used by Operator.
- All lines visible.
- Active session by line.
- Waiting queue by line.

Actions:

- Start Counting.
- Finish Counting.
- Cancel Session if allowed by MVP implementation.

### Receiving

Purpose: manage delivery note data.

Content:

- Receiving list with filters.
- Draft, waiting, counting, completed, cancelled.
- Detail page/form.
- Manifest revision history.

Fields:

- Receiving date.
- Receiving number.
- Delivery note number.
- Document truck sequence.
- Queue position.
- License plate.
- Driver.
- Supplier/farm.
- Manifest count.
- Line.
- Notes.

Actions:

- Create draft.
- Edit draft.
- Edit waiting with audit reason.
- Publish to waiting queue.
- Cancel receiving.
- View detail.

Rules:

- `COUNTING` and `COMPLETED` manifest cannot be changed in MVP.
- Manifest changes from `WAITING` require reason and audit log.

### Sensor Activity

Purpose: inspect all lines and devices.

Content:

- Event stream table.
- Device heartbeat.
- Device status.
- Duplicate/retry indicators.
- Unassigned detection summary.

Actions:

- Filter by line/device/event mode/status.

### Master Data

Purpose: manage reference data.

Sections:

- Trucks.
- Drivers.
- Suppliers/farms.

Rules:

- Receiving records store snapshots so historical receiving data does not change when master data changes.

### Lines & Devices

Purpose: manage physical counting lines and ESP32 devices.

Content:

- Lines.
- Devices.
- Device credentials metadata.
- Last heartbeat.
- Firmware version.
- Wi-Fi RSSI.
- Maintenance status.

Actions:

- Create/edit line.
- Register device.
- Rotate device credential.
- Mark device maintenance/offline.

### Users

Purpose: manage users and roles.

Content:

- Users.
- Assigned role.
- Active/inactive status.
- Last login.

Actions:

- Create user.
- Reset password.
- Assign `OPERATOR` or `ADMIN`.
- Deactivate user.

### Settings

Purpose: configure site behavior.

Content:

- Site name.
- Site timezone, default `Asia/Jakarta`.
- Heartbeat threshold.
- Realtime refresh fallback interval.
- Retention policy placeholder.

### Reports

Purpose: basic operational reporting.

Content:

- Manifest vs actual by period.
- Completed receiving list.
- Difference and percentage.
- Assigned/unassigned detection summary.
- Export placeholder.

### Audit Trail

Purpose: review important historical actions.

Content:

- Actor.
- Role.
- Action.
- Entity type.
- Entity ID.
- Before/after data summary.
- Reason.
- Source.
- Timestamp.

## Design System Components

Use shadcn/ui components where appropriate:

- `Button`
- `Card`
- `Badge`
- `Table`
- `Dialog`
- `Input`
- `Textarea`
- `Select`
- `DropdownMenu`
- `Tabs`
- `Sheet`
- `Toast`
- `Alert`
- `Form`

Use lucide-react icons for:

- Dashboard.
- Truck/receiving.
- Activity/sensor.
- Users.
- Settings.
- Reports.
- Audit.
- Start/finish actions.

## UX Safety Requirements

- Finish Counting must require confirmation.
- Start Counting must require confirmation.
- Show delivery note, license plate, line, and manifest in confirmation dialogs.
- Show warning when sensor is offline or heartbeat is stale.
- Show last detection time near finish action.
- Avoid placing destructive/cancel actions next to primary finish action.
- Badges must include text, not color only.
- Tables must remain readable on desktop and usable on smaller screens.
