import { describe, expect, it } from 'vitest';

export const UI_STATUS_MAP: Record<string, string> = {
  WAITING: 'Menunggu',
  COUNTING: 'Sedang dihitung',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
  DRAFT: 'Draf',
  ASSIGNED: 'Terhubung sesi',
  UNASSIGNED: 'Tanpa sesi',
  ACTIVE: 'Aktif',
  IDLE: 'Siap',
  ONLINE: 'Online',
  DEGRADED: 'Terdegradasi',
  OFFLINE: 'Offline',
  MAINTENANCE: 'Pemeliharaan',
};

describe('Standardized Indonesian UI Copy Dictionary', () => {
  it('maps backend status enums to Indonesian UI terms correctly', () => {
    expect(UI_STATUS_MAP.WAITING).toBe('Menunggu');
    expect(UI_STATUS_MAP.COUNTING).toBe('Sedang dihitung');
    expect(UI_STATUS_MAP.COMPLETED).toBe('Selesai');
    expect(UI_STATUS_MAP.CANCELLED).toBe('Dibatalkan');
    expect(UI_STATUS_MAP.DRAFT).toBe('Draf');
    expect(UI_STATUS_MAP.ASSIGNED).toBe('Terhubung sesi');
    expect(UI_STATUS_MAP.UNASSIGNED).toBe('Tanpa sesi');
    expect(UI_STATUS_MAP.IDLE).toBe('Siap');
  });
});
