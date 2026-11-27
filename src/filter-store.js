/**
 * Persist the archive browser's community search and UTC date range.
 *
 * Only these three fields are stored, matching the demo acceptance rule:
 * after a refresh the last selected Reddit community and date range return.
 * The sort order intentionally stays a per-page preference.
 */

export const FILTER_STORAGE_KEY = 'reddit-archive-demo.filters.v1';

const EMPTY_FILTERS = Object.freeze({ query: '', from: '', to: '' });
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (!DATE_ONLY.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.valueOf()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export function sanitizeSavedFilters(value) {
  if (value === null || typeof value !== 'object') {
    return { ...EMPTY_FILTERS };
  }
  return {
    query: typeof value.query === 'string' ? value.query : '',
    from:
      typeof value.from === 'string' && isValidDate(value.from) ? value.from : '',
    to: typeof value.to === 'string' && isValidDate(value.to) ? value.to : '',
  };
}

export function loadSavedFilters(storage, storageKey = FILTER_STORAGE_KEY) {
  if (!storage) return { ...EMPTY_FILTERS };
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return { ...EMPTY_FILTERS };
    return sanitizeSavedFilters(JSON.parse(raw));
  } catch {
    return { ...EMPTY_FILTERS };
  }
}

export function saveFilters(storage, filters, storageKey = FILTER_STORAGE_KEY) {
  if (!storage) return false;
  try {
    storage.setItem(storageKey, JSON.stringify(sanitizeSavedFilters(filters)));
    return true;
  } catch {
    return false;
  }
}
