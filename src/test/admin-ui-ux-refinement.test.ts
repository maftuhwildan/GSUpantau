import { describe, it, expect } from 'vitest';
import { formatAuditActionLabel, formatAuditEntityLabel } from '../lib/audit-filter';
import { computeAuditDiff, redactSensitiveData } from '../lib/audit-diff';

describe('Admin UI/UX Refinement Helpers', () => {
  describe('Audit Filter Labels (Bahasa Indonesia)', () => {
    it('formats audit action labels correctly in Bahasa Indonesia', () => {
      expect(formatAuditActionLabel('LOGIN')).toBe('Login');
      expect(formatAuditActionLabel('RECEIVING_CREATE')).toBe('Buat Surat Jalan');
      expect(formatAuditActionLabel('CREATE_LINE')).toBe('Buat Jalur');
      expect(formatAuditActionLabel('UPDATE_LINE')).toBe('Ubah Jalur');
      expect(formatAuditActionLabel('CREATE_TRUCK')).toBe('Buat Truk');
      expect(formatAuditActionLabel('UPDATE_TRUCK')).toBe('Ubah Truk');
      expect(formatAuditActionLabel('RESET_PASSWORD')).toBe('Reset Kata Sandi');
    });

    it('formats audit entity labels correctly in Bahasa Indonesia', () => {
      expect(formatAuditEntityLabel('line')).toBe('Jalur');
      expect(formatAuditEntityLabel('truck')).toBe('Truk');
      expect(formatAuditEntityLabel('receiving')).toBe('Surat Jalan');
      expect(formatAuditEntityLabel('settings')).toBe('Pengaturan');
      expect(formatAuditEntityLabel('user')).toBe('Pengguna');
    });
  });

  describe('Audit Diff Helper', () => {
    it('computes diff between before and after objects, excluding identical fields', () => {
      const before = { name: 'Ahmad', role: 'OPERATOR', status: 'ACTIVE', phone: '08123' };
      const after = { name: 'Ahmad', role: 'ADMIN', status: 'ACTIVE', phone: null };

      const diff = computeAuditDiff(before, after);
      expect(diff).toEqual([
        { field: 'role', beforeValue: 'OPERATOR', afterValue: 'ADMIN' },
        { field: 'phone', beforeValue: '08123', afterValue: '—' },
      ]);
    });

    it('redacts sensitive keys in diff calculation', () => {
      const before = { email: 'admin@test.com', password_hash: 'hash1' };
      const after = { email: 'admin@test.com', password_hash: 'hash2' };

      const diff = computeAuditDiff(before, after);
      expect(diff).toEqual([
        { field: 'password_hash', beforeValue: '[TERSEMBUNYI]', afterValue: '[TERSEMBUNYI]' },
      ]);
    });

    it('redacts sensitive keys in raw object redaction helper', () => {
      const data = {
        id: '123',
        email: 'user@test.com',
        credential_hash: 'secret_hash',
        user_token: 'xyz_token',
        nested: {
          password: 'my_password',
          cookie: 'session_cookie',
          publicInfo: 'ok',
        },
      };

      const redacted = redactSensitiveData(data);
      expect(redacted).toEqual({
        id: '123',
        email: 'user@test.com',
        credential_hash: '[TERSEMBUNYI]',
        user_token: '[TERSEMBUNYI]',
        nested: {
          password: '[TERSEMBUNYI]',
          cookie: '[TERSEMBUNYI]',
          publicInfo: 'ok',
        },
      });
    });
  });
});
