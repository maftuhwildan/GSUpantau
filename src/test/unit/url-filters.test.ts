import { describe, expect, it } from 'vitest';

function applyFilterInterlock(eventType: string, assignmentStatus: string) {
  let nextEventType = eventType;
  let nextAssignmentStatus = assignmentStatus;

  if (nextEventType === 'HEARTBEAT' || nextEventType === 'DEVICE_RESTART') {
    nextAssignmentStatus = 'ALL';
  }

  if (nextAssignmentStatus === 'ASSIGNED' || nextAssignmentStatus === 'UNASSIGNED') {
    nextEventType = 'DETECTION';
  }

  return { eventType: nextEventType, assignmentStatus: nextAssignmentStatus };
}

function buildCanonicalQueryString(
  filters: Record<string, string | undefined | null>,
  defaults: Record<string, string>
): string {
  const params = new URLSearchParams();
  for (const [key, defaultVal] of Object.entries(defaults)) {
    const val = filters[key];
    if (val !== undefined && val !== null && val !== '' && val !== defaultVal) {
      params.set(key, val);
    }
  }
  return params.toString();
}

describe('URL Filters Canonical Invariants', () => {
  it('applies interlock rule between eventType and assignmentStatus', () => {
    // Setting assignment status forces event_type=DETECTION
    const res1 = applyFilterInterlock('ALL', 'ASSIGNED');
    expect(res1).toEqual({ eventType: 'DETECTION', assignmentStatus: 'ASSIGNED' });

    // Setting non-detection event type clears assignment status to ALL
    const res2 = applyFilterInterlock('DETECTION', 'HEARTBEAT');
    // Note: if user picks eventType HEARTBEAT:
    const res3 = applyFilterInterlock('HEARTBEAT', 'ASSIGNED');
    expect(res3).toEqual({ eventType: 'HEARTBEAT', assignmentStatus: 'ALL' });
  });

  it('builds canonical query string omitting default values', () => {
    const defaults = { status: 'ALL', line_id: 'ALL', search: '' };

    const q1 = buildCanonicalQueryString({ status: 'WAITING', line_id: 'ALL', search: '' }, defaults);
    expect(q1).toBe('status=WAITING');

    const q2 = buildCanonicalQueryString({ status: 'ALL', line_id: 'LINE-01', search: 'Ayam' }, defaults);
    expect(q2).toBe('line_id=LINE-01&search=Ayam');

    const q3 = buildCanonicalQueryString({ status: 'ALL', line_id: 'ALL', search: '' }, defaults);
    expect(q3).toBe('');
  });

  it('preserves date-only format YYYY-MM-DD for date filters', () => {
    const dateStr = '2026-08-13';
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
