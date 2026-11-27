import test from 'node:test';
import assert from 'node:assert/strict';

import { createWallet } from '../../src/wallet.js';
import { EXPORT_PRICE, exportSelection } from '../../src/export.js';
import { POSTS, filterPosts } from '../../src/catalog.js';
import { parseCsv } from './helpers.js';

const FIXED_NOW = new Date('2026-11-23T09:05:07.123Z');
const rows = POSTS.slice(0, 3);

test('empty selections are rejected without charging', () => {
  const wallet = createWallet();
  wallet.topUp(10, 'topup');

  const result = exportSelection({
    rows: [],
    wallet,
    requestId: 'export-empty',
    now: FIXED_NOW,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'empty');
  assert.equal(result.balance, 10);
  assert.equal(wallet.getState().balance, 10);
  assert.equal(wallet.getState().transactions.length, 1);
});

test('insufficient balance is rejected without charging', () => {
  const wallet = createWallet();

  const result = exportSelection({
    rows,
    wallet,
    requestId: 'export-broke',
    now: FIXED_NOW,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'insufficient_balance');
  assert.equal(result.required, EXPORT_PRICE);
  assert.equal(result.balance, 0);
  assert.equal(wallet.getState().transactions.length, 0);
});

test('successful export charges exactly three credits and returns filtered CSV', () => {
  const wallet = createWallet();
  wallet.topUp(10, 'topup');

  const selected = filterPosts(POSTS, {
    query: 'mossy',
    from: '2026-09-01',
    to: '2026-10-31',
    sort: 'score-desc',
  });

  const result = exportSelection({
    rows: selected,
    wallet,
    requestId: 'export-ok',
    now: FIXED_NOW,
  });

  assert.equal(result.ok, true);
  assert.equal(result.duplicate, false);
  assert.equal(result.rowCount, 3);
  assert.equal(result.spent, 3);
  assert.equal(result.balance, 7);
  assert.equal(result.filename, 'reddit-archive-20261123-090507.csv');
  assert.equal(wallet.getState().balance, 7);

  const lines = result.csv.replace(/^\uFEFF/, '').trimEnd().split('\r\n');
  assert.equal(lines.length, 4);
  assert.ok(!result.csv.includes('quiet_orbit'));
  assert.ok(result.csv.includes('r/mossy_circuits'));
  assert.ok(result.csv.includes('教程：把旧路由器'));
});

test('export pricing stays exact across repeated exports', () => {
  const wallet = createWallet();
  wallet.topUp(10, 'topup');

  const balances = [];
  for (let index = 0; index < 3; index += 1) {
    const result = exportSelection({
      rows,
      wallet,
      requestId: `export-${index}`,
      now: FIXED_NOW,
    });
    assert.equal(result.ok, true);
    balances.push(result.balance);
  }
  assert.deepEqual(balances, [7, 4, 1]);

  const blocked = exportSelection({
    rows,
    wallet,
    requestId: 'export-blocked',
    now: FIXED_NOW,
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'insufficient_balance');
  assert.equal(blocked.balance, 1);
  assert.equal(wallet.getState().balance, 1);
  assert.equal(wallet.getState().transactions.length, 4);
});

test('a repeated request id cannot double-charge or double-export', () => {
  const wallet = createWallet();
  wallet.topUp(10, 'topup');

  const first = exportSelection({
    rows,
    wallet,
    requestId: 'same-request',
    now: FIXED_NOW,
  });
  const second = exportSelection({
    rows,
    wallet,
    requestId: 'same-request',
    now: FIXED_NOW,
  });

  assert.equal(first.ok, true);
  assert.equal(first.balance, 7);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(second.spent, 0);
  assert.equal(second.balance, 7);
  assert.equal(wallet.getState().balance, 7);
  assert.equal(wallet.getState().transactions.length, 2);
});

test('exported rows follow the current sort order', () => {
  const wallet = createWallet();
  wallet.topUp(10, 'topup');

  const selected = filterPosts(POSTS, { sort: 'score-desc' }).slice(0, 5);
  const result = exportSelection({
    rows: selected,
    wallet,
    requestId: 'sorted-export',
    now: FIXED_NOW,
  });

  const rows = parseCsv(result.csv);
  assert.deepEqual(
    rows.slice(1).map((row) => row[1]),
    selected.map((post) => post.title),
  );
});
