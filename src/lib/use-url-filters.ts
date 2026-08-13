'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export type FilterParams = Record<string, string | undefined | null>;
type FilterUpdates<T extends FilterParams> = Partial<
  Record<keyof T, string | undefined | null>
>;

export function useUrlFilters<T extends FilterParams>(
  defaultFilters: T,
  options?: { debounceSearchKey?: string; debounceMs?: number }
) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [stableDefaultFilters] = useState<T>(() => defaultFilters);

  // Parse filters from current searchParams or fallback to defaults
  const getFiltersFromUrl = useCallback((): T => {
    const parsed = { ...stableDefaultFilters } as T;
    for (const key of Object.keys(stableDefaultFilters)) {
      const val = searchParams.get(key);
      if (val !== null) {
        (parsed as FilterParams)[key] = val;
      }
    }
    return parsed;
  }, [searchParams, stableDefaultFilters]);

  const [filters, setFiltersState] = useState<T>(getFiltersFromUrl);

  // Sync internal state when URL searchParams change (e.g. back/forward navigation)
  useEffect(() => {
    const next = getFiltersFromUrl();
    setFiltersState((current) => {
      const keys = Object.keys(stableDefaultFilters);
      const unchanged = keys.every((key) => current[key] === next[key]);
      return unchanged ? current : next;
    });
  }, [getFiltersFromUrl, stableDefaultFilters]);

  // Update URL string via router.replace while retaining unknown parameters
  const updateUrl = useCallback(
    (newFilters: T) => {
      const currentParams = new URLSearchParams(searchParams.toString());

      for (const [key, defaultVal] of Object.entries(stableDefaultFilters)) {
        const newVal = newFilters[key];
        if (newVal !== undefined && newVal !== null && newVal !== '' && newVal !== defaultVal) {
          currentParams.set(key, String(newVal));
        } else {
          currentParams.delete(key);
        }
      }

      const queryString = currentParams.toString();
      if (queryString === searchParams.toString()) return;

      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(newUrl, { scroll: false });
    },
    [searchParams, pathname, router, stableDefaultFilters]
  );

  const setFilters = useCallback(
    (updates: FilterUpdates<T>) => {
      const next = { ...filters, ...updates } as T;

      // Interlock rule for sensor activity filters.
      if (
        updates.event_type === 'HEARTBEAT' ||
        updates.event_type === 'DEVICE_RESTART'
      ) {
        if ('assignment_status' in next) {
          (next as FilterParams).assignment_status = 'ALL';
        }
      }
      if (
        updates.assignment_status === 'ASSIGNED' ||
        updates.assignment_status === 'UNASSIGNED'
      ) {
        if ('event_type' in next) {
          (next as FilterParams).event_type = 'DETECTION';
        }
      }

      setFiltersState(next);
      updateUrl(next);
    },
    [filters, updateUrl]
  );

  const setFilter = useCallback(
    (key: keyof T, value: string | undefined | null) => {
      setFilters({ [key]: value ?? stableDefaultFilters[key] } as FilterUpdates<T>);
    },
    [setFilters, stableDefaultFilters]
  );

  const resetFilters = useCallback(() => {
    setFiltersState(stableDefaultFilters);
    updateUrl(stableDefaultFilters);
  }, [stableDefaultFilters, updateUrl]);

  return {
    filters,
    setFilter,
    setFilters,
    resetFilters,
  };
}
