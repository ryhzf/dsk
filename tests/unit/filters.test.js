import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_FILTERS } from '../../src/catalog.js';
import {
  FILTERS_STORAGE_KEY,
  createFilterStore,
  normalizeFilters,
  parseFilters,
  serializeFilters,
} from '../../src/filters.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    raw(key) {
      return values.get(key);
    },
  };
}

test('filter store starts from defaults when nothing was saved', () => {
  const store = createFilterStore({ storage: memoryStorage() });
  assert.deepEqual(store.load(), DEFAULT_FILTERS);
  assert.equal(store.getPersistenceError(), null);
});

test('saved community, date, and sort choices load back unchanged', () => {
  const storage = memoryStorage();
  const store = createFilterStore({ storage });
  const filters = {
    query: 'mossy_circuits',
    from: '2026-09-01',
    to: '2026-10-31',
    sort: 'score-desc',
  };

  assert.equal(store.save(filters), true);
  assert.deepEqual(store.load(), filters);
  assert.deepEqual(createFilterStore({ storage }).load(), filters);
  assert.deepEqual(JSON.parse(storage.raw(FILTERS_STORAGE_KEY)), {
    version: 1,
    ...filters,
  });
});

test('clearing filters persists the defaults so a refresh stays cleared', () => {
  const storage = memoryStorage();
  const store = createFilterStore({ storage });
  store.save({
    query: 'mossy_circuits',
    from: '2026-09-01',
    to: '2026-10-31',
    sort: 'score-desc',
  });
  store.save(DEFAULT_FILTERS);
  assert.deepEqual(store.load(), DEFAULT_FILTERS);
});

test('malformed, array, or version-mismatched stored state falls back to defaults', () => {
  for (const raw of [
    'not json',
    'null',
    '[]',
    '"mossy"',
    '{"query":"mossy"}',
    JSON.stringify({ version: 2, query: 'mossy', from: '', to: '', sort: 'newest' }),
  ]) {
    assert.deepEqual(parseFilters(raw), DEFAULT_FILTERS, `raw value: ${raw}`);
  }
  assert.deepEqual(parseFilters(null), DEFAULT_FILTERS);
});

test('normalizeFilters keeps valid fields and drops unknown or invalid ones', () => {
  assert.deepEqual(
    normalizeFilters({
      query: '  纸潮  ',
      from: '2026-09-01',
      to: '2026-10-31',
      sort: 'oldest',
      extra: 'ignored',
    }),
    {
      query: '  纸潮  ',
      from: '2026-09-01',
      to: '2026-10-31',
      sort: 'oldest',
    },
  );

  assert.deepEqual(normalizeFilters(null), DEFAULT_FILTERS);
  assert.deepEqual(
    normalizeFilters({
      query: 7,
      from: '2026-02-30',
      to: '2026-9-1',
      sort: 'sideways',
    }),
    DEFAULT_FILTERS,
  );
  assert.equal(normalizeFilters({ query: 'x'.repeat(500) }).query.length, 200);
  assert.deepEqual(parseFilters(serializeFilters({})), DEFAULT_FILTERS);
});

test('storage failures keep in-memory filters usable and are reported', () => {
  const store = createFilterStore({
    storage: {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    },
  });

  assert.deepEqual(store.load(), DEFAULT_FILTERS);
  assert.equal(store.getPersistenceError()?.message, 'blocked');
  assert.equal(store.save({ query: 'mossy_circuits' }), false);
  assert.equal(store.getPersistenceError()?.message, 'blocked');
});

test('no storage adapter means a session-only filter store', () => {
  const store = createFilterStore();
  assert.deepEqual(store.load(), DEFAULT_FILTERS);
  assert.equal(store.save({ query: 'mossy_circuits', sort: 'oldest' }), false);
  // Nothing was stored, so a fresh load is still the default view.
  assert.deepEqual(store.load(), DEFAULT_FILTERS);
});
