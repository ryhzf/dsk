import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FILTER_STORAGE_KEY,
  loadSavedFilters,
  sanitizeSavedFilters,
  saveFilters,
} from '../../src/filter-store.js';

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

test('missing saved filters load as an empty selection', () => {
  assert.deepEqual(loadSavedFilters(memoryStorage()), {
    query: '',
    from: '',
    to: '',
  });
  assert.deepEqual(loadSavedFilters(null), { query: '', from: '', to: '' });
});

test('community search and date range round-trip through storage', () => {
  const storage = memoryStorage();
  const saved = {
    query: 'paper_tides',
    from: '2026-09-01',
    to: '2026-10-31',
    sort: 'score-desc',
  };

  assert.equal(saveFilters(storage, saved), true);
  assert.deepEqual(JSON.parse(storage.raw(FILTER_STORAGE_KEY)), {
    query: 'paper_tides',
    from: '2026-09-01',
    to: '2026-10-31',
  });
  assert.deepEqual(loadSavedFilters(storage), {
    query: 'paper_tides',
    from: '2026-09-01',
    to: '2026-10-31',
  });
});

test('cleared filters persist as an empty selection', () => {
  const storage = memoryStorage();
  saveFilters(storage, { query: 'mossy', from: '2026-09-01', to: '2026-10-31' });
  saveFilters(storage, { query: '', from: '', to: '' });

  assert.deepEqual(loadSavedFilters(storage), { query: '', from: '', to: '' });
});

test('malformed or invalid stored values fall back safely', () => {
  const malformed = memoryStorage({
    [FILTER_STORAGE_KEY]: '{not json',
  });
  assert.deepEqual(loadSavedFilters(malformed), { query: '', from: '', to: '' });

  assert.deepEqual(
    sanitizeSavedFilters({
      query: 'quiet',
      from: '2026-02-30',
      to: 'not-a-date',
    }),
    { query: 'quiet', from: '', to: '' },
  );
  assert.deepEqual(sanitizeSavedFilters('nope'), { query: '', from: '', to: '' });
  assert.deepEqual(sanitizeSavedFilters({ query: 42, from: null, to: {} }), {
    query: '',
    from: '',
    to: '',
  });
});

test('storage write failures are reported without throwing', () => {
  const failingStorage = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('quota');
    },
  };

  assert.deepEqual(loadSavedFilters(failingStorage), {
    query: '',
    from: '',
    to: '',
  });
  assert.equal(saveFilters(failingStorage, { query: 'mossy' }), false);
});
