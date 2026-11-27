import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EXPORT_PRICE,
  TOP_UP_AMOUNTS,
  WALLET_STORAGE_KEY,
  createWallet,
} from '../../src/wallet.js';

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

function idFactory() {
  let count = 0;
  return () => `id-${++count}`;
}

const FIXED_NOW = () => new Date('2026-11-23T09:00:00.000Z');

test('wallet starts empty', () => {
  const wallet = createWallet();
  assert.deepEqual(wallet.getState(), { balance: 0, transactions: [] });
});

test('top-up adds the selected amount once per request', () => {
  const wallet = createWallet({ now: FIXED_NOW, createId: idFactory() });

  const first = wallet.topUp(10, 'topup-1');
  assert.equal(first.ok, true);
  assert.equal(first.balance, 10);
  assert.equal(first.transaction.type, 'topup');
  assert.equal(first.transaction.amount, 10);
  assert.equal(first.transaction.balanceAfter, 10);
  assert.equal(first.transaction.at, '2026-11-23T09:00:00.000Z');

  const duplicate = wallet.topUp(10, 'topup-1');
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.transaction, null);

  const state = wallet.getState();
  assert.equal(state.balance, 10);
  assert.equal(state.transactions.length, 1);
});

test('separate top-ups accumulate and persist', () => {
  const storage = memoryStorage();
  const wallet = createWallet({ storage, now: FIXED_NOW, createId: idFactory() });

  wallet.topUp(10, 'topup-a');
  wallet.topUp(25, 'topup-b');
  assert.equal(wallet.getState().balance, 35);

  const reloaded = createWallet({ storage, now: FIXED_NOW, createId: idFactory() });
  const state = reloaded.getState();
  assert.equal(state.balance, 35);
  assert.equal(state.transactions.length, 2);
  assert.deepEqual(
    state.transactions.map((transaction) => transaction.amount),
    [10, 25],
  );

  // A request id that was already processed must not double-credit after reload.
  const duplicate = reloaded.topUp(10, 'topup-a');
  assert.equal(duplicate.duplicate, true);
  assert.equal(reloaded.getState().balance, 35);
});

test('only the offered top-up amounts are accepted', () => {
  const wallet = createWallet();
  assert.deepEqual([...TOP_UP_AMOUNTS], [10, 25]);
  for (const amount of [0, 5, 20, 100, 10.5, -10]) {
    assert.throws(() => wallet.topUp(amount, `bad-${amount}`), RangeError);
  }
});

test('a top-up requires a request id to stay idempotent', () => {
  const wallet = createWallet();
  assert.throws(() => wallet.topUp(10, ''), TypeError);
  assert.equal(wallet.getState().balance, 0);
});

test('spending for an export deducts exactly three credits', () => {
  const wallet = createWallet({ now: FIXED_NOW, createId: idFactory() });
  wallet.topUp(10, 'topup');

  const result = wallet.spendForExport('export-1', { rowCount: 12 });
  assert.equal(result.ok, true);
  assert.equal(result.balance, 7);
  assert.equal(result.transaction.type, 'export');
  assert.equal(result.transaction.amount, -EXPORT_PRICE);
  assert.equal(result.transaction.balanceAfter, 7);
  assert.match(result.transaction.description, /12 行/);

  const state = wallet.getState();
  assert.equal(state.balance, 7);
  assert.deepEqual(
    state.transactions.map((transaction) => transaction.amount),
    [10, -3],
  );
});

test('three exports leave one credit and the next is rejected unchanged', () => {
  const wallet = createWallet();
  wallet.topUp(10, 'topup');

  assert.equal(wallet.spendForExport('e1', { rowCount: 1 }).balance, 7);
  assert.equal(wallet.spendForExport('e2', { rowCount: 2 }).balance, 4);
  assert.equal(wallet.spendForExport('e3', { rowCount: 3 }).balance, 1);

  const blocked = wallet.spendForExport('e4', { rowCount: 4 });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'insufficient_balance');
  assert.equal(blocked.required, 3);
  assert.equal(blocked.balance, 1);

  const state = wallet.getState();
  assert.equal(state.balance, 1);
  assert.equal(state.transactions.length, 4);
  assert.deepEqual(
    state.transactions.map((transaction) => transaction.amount),
    [10, -3, -3, -3],
  );
});

test('export spending is rejected with a zero balance and leaves no trace', () => {
  const wallet = createWallet();
  const blocked = wallet.spendForExport('export-zero', { rowCount: 5 });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'insufficient_balance');
  assert.equal(blocked.balance, 0);
  assert.equal(wallet.getState().transactions.length, 0);
});

test('a repeated export request cannot double-charge', () => {
  const wallet = createWallet();
  wallet.topUp(10, 'topup');

  const first = wallet.spendForExport('same-export', { rowCount: 2 });
  const second = wallet.spendForExport('same-export', { rowCount: 2 });

  assert.equal(first.balance, 7);
  assert.equal(second.duplicate, true);
  assert.equal(second.balance, 7);
  assert.equal(wallet.getState().balance, 7);
  assert.equal(wallet.getState().transactions.length, 2);
});

test('corrupt or inconsistent persisted state resets safely', () => {
  const corrupt = memoryStorage({
    [WALLET_STORAGE_KEY]: '{not json',
  });
  assert.equal(createWallet({ storage: corrupt }).getState().balance, 0);

  const inconsistent = memoryStorage({
    [WALLET_STORAGE_KEY]: JSON.stringify({
      version: 1,
      balance: 999,
      transactions: [],
      processedRequests: [],
    }),
  });
  assert.equal(createWallet({ storage: inconsistent }).getState().balance, 0);

  const mismatchedTransaction = memoryStorage({
    [WALLET_STORAGE_KEY]: JSON.stringify({
      version: 1,
      balance: 10,
      transactions: [
        {
          id: 'x',
          requestId: 'r',
          type: 'topup',
          amount: 25,
          balanceAfter: 25,
          at: '2026-11-23T09:00:00.000Z',
          description: '模拟充值 25 积分',
        },
      ],
      processedRequests: ['r'],
    }),
  });
  assert.equal(
    createWallet({ storage: mismatchedTransaction }).getState().balance,
    0,
  );
});

test('a storage failure keeps the wallet usable in memory', () => {
  const failingStorage = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('quota');
    },
  };
  const wallet = createWallet({ storage: failingStorage });
  const result = wallet.topUp(10, 'topup');
  assert.equal(result.balance, 10);
  assert.equal(wallet.getState().balance, 10);
  assert.ok(wallet.getPersistenceError() instanceof Error);
});
