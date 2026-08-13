/**
 * Helper utilities for audit log diff calculation and data redaction.
 */

const SENSITIVE_KEY_REGEX = /password|secret|token|credential|cookie/i;

export interface AuditDiffItem {
  field: string;
  beforeValue: string;
  afterValue: string;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_REGEX.test(key);
}

function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'Ya' : 'Tidak';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Computes difference between beforeData and afterData for human-readable audit presentation.
 * Excludes unchanged fields and redacts sensitive keys.
 */
export function computeAuditDiff(
  beforeData: Record<string, any> | null | undefined,
  afterData: Record<string, any> | null | undefined
): AuditDiffItem[] {
  const before = beforeData && typeof beforeData === 'object' ? beforeData : {};
  const after = afterData && typeof afterData === 'object' ? afterData : {};

  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const diffs: AuditDiffItem[] = [];

  for (const key of allKeys) {
    const bVal = before[key];
    const aVal = after[key];

    const isBValNullish = bVal === null || bVal === undefined;
    const isAValNullish = aVal === null || aVal === undefined;

    if (isBValNullish && isAValNullish) {
      continue;
    }

    if (JSON.stringify(bVal) === JSON.stringify(aVal)) {
      continue;
    }

    if (isSensitiveKey(key)) {
      diffs.push({
        field: key,
        beforeValue: bVal !== undefined ? '[TERSEMBUNYI]' : '—',
        afterValue: aVal !== undefined ? '[TERSEMBUNYI]' : '—',
      });
      continue;
    }

    diffs.push({
      field: key,
      beforeValue: formatValue(bVal),
      afterValue: formatValue(aVal),
    });
  }

  return diffs;
}

/**
 * Deeply redacts sensitive keys in JSON objects before rendering raw payload.
 */
export function redactSensitiveData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (isSensitiveKey(key)) {
        redacted[key] = '[TERSEMBUNYI]';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }
    return redacted as T;
  }

  return data;
}
