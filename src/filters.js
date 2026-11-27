/**
 * Persisted archive filter state (community search, UTC date range, sort).
 *
 * The store is intentionally tiny and framework-free: the app hands it the
 * same Web Storage adapter the wallet uses, so a blocked localStorage degrades
 * to an in-memory session instead of breaking filtering.
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
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Coerce untrusted JSON into a complete filter object. Unknown or malformed
 * fields fall back to their default instead of leaking into the UI.
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
  return JSON.stringify({ version: FILTERS_VERSION, ...normalizeFilters(filters) });
}

export function parseFilters(raw) {
  if (!raw) return { ...DEFAULT_FILTERS };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_FILTERS };
  }
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    parsed.version !== FILTERS_VERSION
  ) {
    return { ...DEFAULT_FILTERS };
  }
  return normalizeFilters(parsed);
}

/**
 * Create a filter store bound to a Web Storage-like adapter
 * (`getItem`/`setItem`). `storage: null` keeps it in memory.
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

  return {
    load,
    save,
    getPersistenceError: () => persistenceError,
  };
}
