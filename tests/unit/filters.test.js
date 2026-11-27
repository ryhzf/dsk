import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_FILTERS } from '../../src/catalog.js';
import {
  FILTERS_STORAGE_KEY,
  FILTERS_VERSION,
  createFilterStore,
  normalizeFilters,
  parseFilters,
  serializeFilters,
} from '../../src/filters.js';

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    dump: () => Object.fromEntries(values),
  };
}

function brokenStorage() {
  const fail = () => {
    throw new Error('storage blocked');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

test('normalizeFilters falls back to defaults for absent or non-object input', () => {
  for (const input of [undefined, null, '', 'filters', 42, []]) {
    assert.deepEqual(normalizeFilters(input), { ...DEFAULT_FILTERS });
  }
});

test('normalizeFilters keeps a complete valid filter selection', () => {
  const filters = {
    query: 'r/quiet_orbit',
    from: '2026-09-01',
    to: '2026-10-31',
    sort: 'score-desc',
  };
  assert.deepEqual(normalizeFilters(filters), filters);
});

test('normalizeFilters rejects malformed dates and unknown sorts', () => {
  const normalized = normalizeFilters({
    query: 7,
    from: '2026-02-30',
    to: '2026-13-01',
    sort: 'comments',
  });
  assert.deepEqual(normalized, { ...DEFAULT_FILTERS });

  assert.equal(normalizeFilters({ from: '2026/09/01' }).from, '');
  assert.equal(normalizeFilters({ to: '2026-09-31' }).to, '');
  assert.equal(normalizeFilters({ sort: 'newest' }).sort, 'newest');
});

test('normalizeFilters truncates very long search queries', () => {
  const query = 'x'.repeat(500);
  assert.equal(normalizeFilters({ query }).query.length, 200);
});

test('parseFilters ignores absent, corrupt, and wrong-version payloads', () => {
  for (const raw of [
    null,
    undefined,
    '',
    'not-json',
    'null',
    '[]',
    JSON.stringify({ version: FILTERS_VERSION + 1, query: 'mossy' }),
    JSON.stringify({ version: '1', query: 'mossy' }),
  ]) {
    assert.deepEqual(parseFilters(raw), { ...DEFAULT_FILTERS });
  }
});

test('serializeFilters and parseFilters round-trip a normalized selection', () => {
  const saved = serializeFilters({
    query: 'mossy',
    from: '2026-09-01',
    to: '2026-10-31',
    sort: 'score-desc',
    ignored: 'value',
  });
  assert.deepEqual(JSON.parse(saved), {
    version: FILTERS_VERSION,
    query: 'mossy',
    from: '2026-09-01',
    to: '2026-10-31',
    sort: 'score-desc',
  });
  assert.deepEqual(parseFilters(saved), {
    query: 'mossy',
    from: '2026-09-01',
    to: '2026-10-31',
    sort: 'score-desc',
  });
});

test('createFilterStore saves, reloads, and clears the stored selection', () => {
  const storage = memoryStorage();
  const store = createFilterStore({ storage });

  assert.deepEqual(store.load(), { ...DEFAULT_FILTERS });
  assert.equal(store.save({ query: 'paper', from: '2026-09-01', to: '' }), true);
  assert.ok(storage.dump()[FILTERS_STORAGE_KEY]);

  const reloaded = createFilterStore({ storage });
  assert.deepEqual(reloaded.load(), {
    query: 'paper',
    from: '2026-09-01',
    to: '',
    sort: 'newest',
  });

  assert.equal(store.clear(), true);
  assert.equal(storage.dump()[FILTERS_STORAGE_KEY], undefined);
  assert.deepEqual(store.load(), { ...DEFAULT_FILTERS });
});

test('createFilterStore degrades safely when storage is unavailable or broken', () => {
  const broken = createFilterStore({ storage: brokenStorage() });
  assert.deepEqual(broken.load(), { ...DEFAULT_FILTERS });
  assert.ok(broken.getPersistenceError() instanceof Error);
  assert.equal(broken.save({ query: 'mossy' }), false);
  assert.equal(broken.clear(), false);
  assert.ok(broken.getPersistenceError() instanceof Error);

  const memoryOnly = createFilterStore();
  assert.deepEqual(memoryOnly.load(), { ...DEFAULT_FILTERS });
  assert.equal(memoryOnly.save({ query: 'mossy' }), false);
  assert.equal(memoryOnly.clear(), false);
});
