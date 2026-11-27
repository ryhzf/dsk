import assert from 'node:assert/strict';
import test from 'node:test';

import { FIXTURE_EVENTS } from '../../src/data.js';
import {
  CSV_BOM,
  buildEventsCsv,
  buildSummaryCsv,
  escapeCsvCell,
  rowsToCsv,
} from '../../src/csv.js';

const filter = (days, channel = 'all') => ({ days, channel });

function parseCsv(text) {
  assert.equal(text.startsWith(CSV_BOM), true);
  const body = text.slice(CSV_BOM.length);
  assert.equal(body.endsWith('\r\n'), true);
  return body
    .trimEnd()
    .split('\r\n')
    .map((line) => line.split(','));
}

test('event CSV has a BOM, stable header and only the filtered intersection', () => {
  const rows = parseCsv(buildEventsCsv(FIXTURE_EVENTS, filter(7, 'Organic')));
  assert.deepEqual(rows[0], ['occurred_at_utc', 'user_id', 'channel', 'event_type']);
  assert.equal(rows.length, 10); // header + 9 Organic events in the 7-day window
  assert.equal(rows[1][0], '2026-11-17T00:00:00Z');
  assert.equal(rows.at(-1)[0], '2026-11-23T23:59:59Z');
  assert.equal(rows.some((row) => row[1] === 'r1'), false);
  assert.equal(rows.some((row) => row[1] === 'old1'), false);
  assert.equal(rows.some((row) => row[0] === '2026-11-24T00:00:00Z'), false);

  const referral = parseCsv(buildEventsCsv(FIXTURE_EVENTS, filter(7, 'Referral')));
  assert.deepEqual(referral.slice(1).map((row) => row[3]), [
    'visit',
    'export_success',
  ]);
  assert.deepEqual(referral.slice(1).map((row) => row[1]), ['r1', 'r1']);
});

test('14-day CSV includes old1 but never the cutoff event', () => {
  const rows = parseCsv(buildEventsCsv(FIXTURE_EVENTS, filter(14, 'all')));
  assert.equal(rows.length, 14); // header + 13 events
  assert.equal(rows.some((row) => row[1] === 'old1'), true);
  assert.equal(rows.some((row) => row[0] === '2026-11-24T00:00:00Z'), false);
  assert.equal(rows.some((row) => row[0] === '2026-11-03T12:00:00Z'), false);
});

test('event CSV is sorted by UTC time', () => {
  const rows = parseCsv(buildEventsCsv(FIXTURE_EVENTS, filter(28, 'all'))).slice(1);
  const times = rows.map((row) => Date.parse(row[0]));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
});

test('summary CSV carries the fixed cutoff, window and metric definitions', () => {
  const rows = parseCsv(buildSummaryCsv(FIXTURE_EVENTS, filter(7, 'Organic')));
  const byMetric = Object.fromEntries(rows.slice(1).map(([metric, value]) => [metric, value]));

  assert.equal(byMetric.cutoff_utc, '2026-11-24T00:00:00Z');
  assert.equal(byMetric.window_start_utc, '2026-11-17T00:00:00Z');
  assert.equal(byMetric.window_end_utc, '2026-11-24T00:00:00Z');
  assert.equal(byMetric.window_days, '7');
  assert.equal(byMetric.channel, 'Organic');
  assert.equal(byMetric.visitors, '4');
  assert.equal(byMetric.first_export_users, '2');
  assert.equal(byMetric.simulated_topup_success_users, '1');
  assert.equal(byMetric.visit_to_first_export_rate, '0.5');
});

test('summary CSV uses zero for empty data and all channels are labelled All', () => {
  const empty = parseCsv(buildSummaryCsv([], filter(28, 'all')));
  const byMetric = Object.fromEntries(empty.slice(1).map(([metric, value]) => [metric, value]));
  assert.equal(byMetric.channel, 'All');
  assert.equal(byMetric.visitors, '0');
  assert.equal(byMetric.first_export_users, '0');
  assert.equal(byMetric.simulated_topup_success_users, '0');
  assert.equal(byMetric.visit_to_first_export_rate, '0');
});

test('CSV escaping quotes, preserves commas/newlines and neutralizes formulas', () => {
  assert.equal(escapeCsvCell('plain'), 'plain');
  assert.equal(escapeCsvCell('a,b'), '"a,b"');
  assert.equal(escapeCsvCell('a"b'), '"a""b"');
  assert.equal(escapeCsvCell('a\nb'), '"a\nb"');
  assert.equal(escapeCsvCell('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(
    rowsToCsv([['a', 'b'], ['1', '2']]),
    'a,b\r\n1,2\r\n',
  );
});
