/**
 * Persisted archive filters: community search, UTC date range and sort order.
 *
 * The payload is versioned and every field is re-validated on load, so stale,
 * hand-edited or corrupted storage can never put the UI into an invalid state.
 * Callers pass the same Web Storage adapter used by the wallet; when storage is
 * unavailable the helpers simply report that nothing could be loaded/saved.
 */

import { DEFAULT_FILTERS, SORT_OPTIONS } from './catalog.js';

export const FILTERS_STORAGE_KEY = 'reddit-archive-demo.filters.v1';
export const FILTERS_VERSION = 1;

export const MAX_QUERY_LENGTH = 200;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SORT_VALUES = new Set(SORT_OPTIONS.map((option) => option.value));

function isEmpty(value) {
  return value === null || value === undefined;
}

function isValidUtcDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  // Reject values the Date parser would silently roll over, e.g. 2026-02-30.
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

/**
 * Coerce untrusted data into a complete filter object. Each malformed field
 * falls back to its default independently, so one bad value does not discard
 * the other valid selections.
 */
export function normalizeFilters(value) {
  const source = value !== null && typeof value === 'object' ? value : {};
  return {
    query:
      typeof source.query === 'string'
        ? source.query.slice(0, MAX_QUERY_LENGTH)
        : DEFAULT_FILTERS.query,
    from: isValidUtcDate(source.from) ? source.from : DEFAULT_FILTERS.from,
    to: isValidUtcDate(source.to) ? source.to : DEFAULT_FILTERS.to,
    sort: SORT_VALUES.has(source.sort) ? source.sort : DEFAULT_FILTERS.sort,
  };
}

/** Encode filters for localStorage, including the schema version. */
export function serializeFilters(filters) {
  return JSON.stringify({
    version: FILTERS_VERSION,
    ...normalizeFilters(filters),
  });
}

/**
 * Decode a raw localStorage value. A missing, unparseable or differently
 * versioned payload resets to the defaults instead of throwing.
 */
export function parseFilters(raw) {
  if (isEmpty(raw) || typeof raw !== 'string') return { ...DEFAULT_FILTERS };

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

/** Read the last saved filters, falling back to defaults on any storage error. */
export function readFilters(storage, storageKey = FILTERS_STORAGE_KEY) {
  if (!storage) return { ...DEFAULT_FILTERS };
  try {
    return parseFilters(storage.getItem(storageKey));
  } catch {
    return { ...DEFAULT_FILTERS };
  }
}

/**
 * Persist the current filters. Returns false when the write failed (for
 * example a full or blocked localStorage); the in-memory UI state is kept.
 */
export function writeFilters(storage, filters, storageKey = FILTERS_STORAGE_KEY) {
  if (!storage) return false;
  try {
    storage.setItem(storageKey, serializeFilters(filters));
    return true;
  } catch {
    return false;
  }
}
