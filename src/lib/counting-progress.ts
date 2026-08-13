export type CountingProgressState = 'NO_TARGET' | 'BELOW' | 'MATCHED' | 'OVER';

export type CountingProgressPresentation = {
  rawPercent: number | null;
  barPercent: number;
  state: CountingProgressState;
  differenceLabel: string;
  progressLabel: string;
};

export function getCountingProgressPresentation(
  manifestCount: number,
  actualCount: number
): CountingProgressPresentation {
  if (manifestCount <= 0) {
    return {
      rawPercent: null,
      barPercent: 0,
      state: 'NO_TARGET',
      differenceLabel: 'Target tidak tersedia',
      progressLabel: 'Target tidak tersedia',
    };
  }

  const rawPercent = (actualCount / manifestCount) * 100;
  const barPercent = Math.min(100, Math.max(0, rawPercent));
  const diff = actualCount - manifestCount;

  const formattedPercent = Number.isInteger(rawPercent)
    ? `${rawPercent}%`
    : `${Math.round(rawPercent * 10) / 10}%`;

  if (diff < 0) {
    const missing = Math.abs(diff);
    return {
      rawPercent,
      barPercent,
      state: 'BELOW',
      differenceLabel: `Kurang ${missing.toLocaleString('id-ID')} ekor`,
      progressLabel: `${formattedPercent} · Kurang ${missing.toLocaleString('id-ID')} ekor`,
    };
  }

  if (diff === 0) {
    return {
      rawPercent,
      barPercent: 100,
      state: 'MATCHED',
      differenceLabel: 'Sesuai manifest',
      progressLabel: '100% · Sesuai manifest',
    };
  }

  return {
    rawPercent,
    barPercent: 100,
    state: 'OVER',
    differenceLabel: `Lebih ${diff.toLocaleString('id-ID')} ekor`,
    progressLabel: `${formattedPercent} · Lebih ${diff.toLocaleString('id-ID')} ekor`,
  };
}
