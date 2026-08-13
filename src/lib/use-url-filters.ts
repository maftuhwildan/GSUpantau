'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export type FilterParams = Record<string, string | undefined | null>;

export function useUrlFilters<T extends FilterParams>(
  defaultFilters: T,
  options?: { debounceSearchKey?: string; debounceMs?: number }
) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Parse filters from current searchParams or fallback to defaults
  const getFiltersFromUrl = useCallback((): T => {
    const parsed = { ...defaultFilters } as Record<string, string>;
    for (const key of Object.keys(defaultFilters)) {
      const val = searchParams.get(key);
      if (val !== null && val !== undefined) {
        parsed[key] = val;
      }
    }
    return parsed as T;
  }, [searchParams, defaultFilters]);

  const [filters, setFiltersState] = useState<T>(getFiltersFromUrl);

  // Sync internal state when URL searchParams change (e.g. back/forward navigation)
  useEffect(() => {
    setFiltersState(getFiltersFromUrl());
  }, [getFiltersFromUrl]);

  // Update URL string via router.replace while retaining unknown parameters
  const updateUrl = useCallback(
    (newFilters: T) => {
      const currentParams = new URLSearchParams(searchParams.toString());

      for (const [key, defaultVal] of Object.entries(defaultFilters)) {
        const newVal = newFilters[key];
        if (newVal !== undefined && newVal !== null && newVal !== '' && newVal !== defaultVal) {
          currentParams.set(key, String(newVal));
        } else {
          currentParams.delete(key);
        }
      }

      const queryString = currentParams.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(newUrl, { scroll: false });
    },
    [searchParams, pathname, router, defaultFilters]
  );

  const setFilter = useCallback(
    (key: keyof T, value: string | undefined | null) => {
      setFiltersState((prev) => {
        const next = { ...prev, [key]: value ?? defaultFilters[key] };

        // Interlock rule for sensor activity filters:
        if (key === 'event_type' && (value === 'HEARTBEAT' || value === 'DEVICE_RESTART')) {
          if ('assignment_status' in next) {
            (next as Record<string, unknown>).assignment_status = 'ALL';
          }
        }
        if (key === 'assignment_status' && (value === 'ASSIGNED' || value === 'UNASSIGNED')) {
          if ('event_type' in next) {
            (next as Record<string, unknown>).event_type = 'DETECTION';
          }
        }

        updateUrl(next);
        return next;
      });
    },
    [defaultFilters, updateUrl]
  );

  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters);
    updateUrl(defaultFilters);
  }, [defaultFilters, updateUrl]);

  return {
    filters,
    setFilter,
    resetFilters,
  };
}
