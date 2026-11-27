/**
 * Persisted archive filter state: community search, UTC date range, and sort.
 *
 * The store is intentionally small and framework-free. It reuses the same
 * Web Storage adapter as the wallet, so a blocked or full localStorage
 * degrades to an in-memory session instead of breaking the filter controls.
 */

import { DEFAULT_FILTERS, SORT_OPTIONS } from './catalog.js';

export const FILTERS_STORAGE_KEY = 'reddit-archive-demo.filters.v1';
export const FILTERS_VERSION = 1;

const MAX_QUERY_LENGTH = 200;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SORT_VALUES = new Set(SORT_OPTIONS.map((option) => option.value));

function isUtcDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  // Reject normalized overflow such as 2026-02-30.
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Coerce untrusted stored JSON into a complete filter object. Unknown or
 * malformed fields fall back to their default instead of leaking into the UI.
 */
export function normalizeFilters(value) {
  const source = value !== null && typeof value === 'object' ? value : {};
  return {
    query:
      typeof source.query === 'string'
        ? source.query.slice(0, MAX_QUERY_LENGTH)
        : DEFAULT_FILTERS.query,
    from: isUtcDate(source.from) ? source.from : DEFAULT_FILTERS.from,
    to: isUtcDate(source.to) ? source.to : DEFAULT_FILTERS.to,
    sort: SORT_VALUES.has(source.sort) ? source.sort : DEFAULT_FILTERS.sort,
  };
}

export function serializeFilters(filters) {
  return JSON.stringify({
    version: FILTERS_VERSION,
    ...normalizeFilters(filters),
  });
}

export function parseFilters(raw) {
  if (typeof raw !== 'string' || raw === '') return { ...DEFAULT_FILTERS };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_FILTERS };
  }

  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    parsed.version !== FILTERS_VERSION
  ) {
    return { ...DEFAULT_FILTERS };
  }

  return normalizeFilters(parsed);
}

/**
 * Create a filter store bound to a Web Storage-like adapter
 * (`getItem`/`setItem`/`removeItem`). A null adapter keeps it in memory only.
 */
export function createFilterStore({
  storage = null,
  storageKey = FILTERS_STORAGE_KEY,
} = {}) {
  let persistenceError = null;

  function load() {
    if (!storage) return { ...DEFAULT_FILTERS };
    try {
      const filters = parseFilters(storage.getItem(storageKey));
      persistenceError = null;
      return filters;
    } catch (error) {
      persistenceError = error;
      return { ...DEFAULT_FILTERS };
    }
  }

  function save(filters) {
    if (!storage) return false;
    try {
      storage.setItem(storageKey, serializeFilters(filters));
      persistenceError = null;
      return true;
    } catch (error) {
      persistenceError = error;
      return false;
    }
  }

  function clear() {
    if (!storage) return false;
    try {
      storage.removeItem(storageKey);
      persistenceError = null;
      return true;
    } catch (error) {
      persistenceError = error;
      return false;
    }
  }

  return {
    load,
    save,
    clear,
    getPersistenceError: () => persistenceError,
  };
}
