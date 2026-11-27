import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_FILTERS } from '../../src/catalog.js';
import {
  FILTERS_STORAGE_KEY,
  FILTERS_VERSION,
  MAX_QUERY_LENGTH,
  normalizeFilters,
  parseFilters,
  readFilters,
  serializeFilters,
  writeFilters,
} from '../../src/filters.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    read: (key) => values.get(key),
  };
}

test('missing storage falls back to the default filters', () => {
  assert.deepEqual(parseFilters(null), { ...DEFAULT_FILTERS });
  assert.deepEqual(parseFilters(undefined), { ...DEFAULT_FILTERS });
  assert.deepEqual(parseFilters(''), { ...DEFAULT_FILTERS });
  assert.deepEqual(readFilters(null), { ...DEFAULT_FILTERS });
});

test('a saved community and date selection round-trips', () => {
  const storage = memoryStorage();
  const filters = {
    query: 'quiet_orbit',
    from: '2026-09-01',
    to: '2026-10-31',
    sort: 'score-desc',
  };

  assert.equal(writeFilters(storage, filters), true);
  assert.deepEqual(readFilters(storage), filters);
  assert.equal(
    JSON.parse(storage.read(FILTERS_STORAGE_KEY)).version,
    FILTERS_VERSION,
  );
});

test('clearing the filters persists the empty selection', () => {
  const storage = memoryStorage();
  writeFilters(storage, {
    query: 'mossy',
    from: '2026-09-01',
    to: '2026-10-31',
    sort: 'oldest',
  });

  writeFilters(storage, DEFAULT_FILTERS);

  assert.deepEqual(readFilters(storage), { ...DEFAULT_FILTERS });
});

test('corrupt JSON resets to defaults instead of throwing', () => {
  assert.deepEqual(parseFilters('{not json'), { ...DEFAULT_FILTERS });
  assert.deepEqual(parseFilters('"a string"'), { ...DEFAULT_FILTERS });
  assert.deepEqual(parseFilters('[1, 2, 3]'), { ...DEFAULT_FILTERS });
});

test('a payload from another schema version is ignored', () => {
  const storage = memoryStorage({
    [FILTERS_STORAGE_KEY]: JSON.stringify({
      version: FILTERS_VERSION + 1,
      query: 'mossy',
      from: '2026-09-01',
      to: '2026-10-31',
      sort: 'score-desc',
    }),
  });

  assert.deepEqual(readFilters(storage), { ...DEFAULT_FILTERS });
});

test('invalid individual fields fall back without discarding valid ones', () => {
  const normalized = normalizeFilters({
    query: 'paper',
    from: '2026-02-30',
    to: '2026-10-31',
    sort: 'not-a-sort',
  });

  assert.deepEqual(normalized, {
    query: 'paper',
    from: '',
    to: '2026-10-31',
    sort: DEFAULT_FILTERS.sort,
  });
});

test('an overlong query is truncated on write', () => {
  const storage = memoryStorage();
  const query = 'x'.repeat(500);

  writeFilters(storage, { ...DEFAULT_FILTERS, query });

  assert.equal(readFilters(storage).query.length, MAX_QUERY_LENGTH);
});

test('storage errors never break loading or saving', () => {
  const broken = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('quota exceeded');
    },
  };

  assert.deepEqual(readFilters(broken), { ...DEFAULT_FILTERS });
  assert.equal(writeFilters(broken, DEFAULT_FILTERS), false);
});

test('serialized filters are re-validated when parsed', () => {
  const raw = JSON.stringify({
    version: FILTERS_VERSION,
    query: 42,
    from: 'not-a-date',
    to: null,
    sort: 'newest',
  });

  assert.deepEqual(parseFilters(raw), {
    query: '',
    from: '',
    to: '',
    sort: 'newest',
  });
  assert.equal(typeof serializeFilters(DEFAULT_FILTERS), 'string');
});
