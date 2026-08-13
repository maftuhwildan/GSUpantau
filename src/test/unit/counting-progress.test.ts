import { describe, expect, it } from 'vitest';
import { getCountingProgressPresentation } from '@/lib/counting-progress';

describe('getCountingProgressPresentation Invariants', () => {
  it('handles zero or negative manifest count safely without division by zero', () => {
    const res = getCountingProgressPresentation(0, 50);
    expect(res).toEqual({
      rawPercent: null,
      barPercent: 0,
      state: 'NO_TARGET',
      differenceLabel: 'Target tidak tersedia',
      progressLabel: 'Target tidak tersedia',
    });
  });

  it('handles actual below manifest', () => {
    const res = getCountingProgressPresentation(1000, 750);
    expect(res.state).toBe('BELOW');
    expect(res.rawPercent).toBe(75);
    expect(res.barPercent).toBe(75);
    expect(res.differenceLabel).toContain('Kurang 250 ekor');
    expect(res.progressLabel).toBe('75% · Kurang 250 ekor');
  });

  it('handles actual matching manifest', () => {
    const res = getCountingProgressPresentation(500, 500);
    expect(res.state).toBe('MATCHED');
    expect(res.rawPercent).toBe(100);
    expect(res.barPercent).toBe(100);
    expect(res.differenceLabel).toBe('Sesuai manifest');
    expect(res.progressLabel).toBe('100% · Sesuai manifest');
  });

  it('handles overcount (actual exceeding manifest) with raw percent > 100 and capped barPercent', () => {
    const res = getCountingProgressPresentation(1000, 1050);
    expect(res.state).toBe('OVER');
    expect(res.rawPercent).toBe(105);
    expect(res.barPercent).toBe(100);
    expect(res.differenceLabel).toContain('Lebih 50 ekor');
    expect(res.progressLabel).toBe('105% · Lebih 50 ekor');
  });

  it('formats decimal percentages cleanly', () => {
    const res = getCountingProgressPresentation(300, 100);
    expect(res.state).toBe('BELOW');
    expect(res.progressLabel).toBe('33.3% · Kurang 200 ekor');
  });
});
