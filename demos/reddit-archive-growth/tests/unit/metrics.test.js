import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CUTOFF_ISO,
  CUTOFF_MS,
  FIXTURE_EVENTS,
  WINDOW_DAYS,
} from '../../src/data.js';
import {
  ALL_CHANNELS,
  buildChannelRows,
  computeKpis,
  firstExportsByUser,
  isInWindow,
  visitorSet,
  windowStartMs,
} from '../../src/metrics.js';

const filter = (days, channel = ALL_CHANNELS) => ({ days, channel });
const kpis = (days, channel = ALL_CHANNELS) => computeKpis(FIXTURE_EVENTS, filter(days, channel));

test('fixture is exactly the 15 synthetic events from the Issue', () => {
  assert.equal(CUTOFF_ISO, '2026-11-24T00:00:00Z');
  assert.equal(CUTOFF_MS, Date.parse('2026-11-24T00:00:00Z'));
  assert.deepEqual(WINDOW_DAYS, [7, 14, 28]);
  assert.equal(FIXTURE_EVENTS.length, 15);

  const counts = FIXTURE_EVENTS.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] ?? 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(counts, {
    visit: 9,
    simulated_topup_success: 1,
    export_success: 5,
  });
  assert.deepEqual(
    [...new Set(FIXTURE_EVENTS.map((event) => event.channel))],
    ['Organic', 'Referral'],
  );
});

test('window is left-closed and right-open at the pinned UTC cutoff', () => {
  assert.equal(windowStartMs(7), Date.parse('2026-11-17T00:00:00Z'));
  assert.equal(windowStartMs(14), Date.parse('2026-11-10T00:00:00Z'));
  assert.equal(windowStartMs(28), Date.parse('2026-10-27T00:00:00Z'));

  assert.equal(isInWindow(Date.parse('2026-11-17T00:00:00Z'), 7), true);
  assert.equal(isInWindow(Date.parse('2026-11-16T23:59:59Z'), 7), false);
  assert.equal(isInWindow(Date.parse('2026-11-23T23:59:59Z'), 7), true);
  assert.equal(isInWindow(CUTOFF_MS, 7), false);
});

test('acceptance KPI matrix matches the fixed fixture', () => {
  const expected = [
    // days, channel, visitors, first exports, topups, conversion
    [7, ALL_CHANNELS, 5, 3, 1, 0.6],
    [14, ALL_CHANNELS, 6, 4, 1, 4 / 6],
    [28, ALL_CHANNELS, 7, 4, 1, 4 / 7],
    [7, 'Organic', 4, 2, 1, 0.5],
    [14, 'Organic', 5, 3, 1, 0.6],
    [28, 'Organic', 6, 3, 1, 0.5],
    [7, 'Referral', 1, 1, 0, 1],
    [14, 'Referral', 1, 1, 0, 1],
    [28, 'Referral', 1, 1, 0, 1],
  ];

  for (const [days, channel, visitors, firstExportUsers, topupUsers, conversionRate] of expected) {
    const result = kpis(days, channel);
    assert.deepEqual(
      {
        visitors: result.visitors,
        firstExportUsers: result.firstExportUsers,
        topupUsers: result.topupUsers,
        conversionRate: result.conversionRate,
        empty: result.empty,
      },
      {
        visitors,
        firstExportUsers,
        topupUsers,
        conversionRate,
        empty: false,
      },
      `${days}d / ${channel}`,
    );
  }
});

test('boundary users are included/excluded exactly at 7 and 14 days', () => {
  const seven = kpis(7);
  const fourteen = kpis(14);

  // o4 at 23:59:59 the day before cutoff is included; next1 exactly at the
  // right-open cutoff is excluded.
  assert.equal(visitorSet(FIXTURE_EVENTS, filter(7)).has('o4'), true);
  assert.equal(visitorSet(FIXTURE_EVENTS, filter(7)).has('next1'), false);

  // old1 is two seconds before the 7-day left edge, so excluded there, but
  // inside the 14-day window.
  assert.equal(visitorSet(FIXTURE_EVENTS, filter(7)).has('old1'), false);
  assert.equal(visitorSet(FIXTURE_EVENTS, filter(14)).has('old1'), true);
  assert.equal(seven.firstExportUsers, 3);
  assert.equal(fourteen.firstExportUsers, 4);

  // o1's visit on Nov 18 and second export do not create a second conversion.
  assert.equal(seven.firstExportUsers, 3);
});

test('first export is taken from the whole fixture, not from a later window', () => {
  const nov18 = computeKpis(FIXTURE_EVENTS, {
    days: 1,
    channel: ALL_CHANNELS,
    cutoffMs: Date.parse('2026-11-19T00:00:00Z'),
  });
  // o1 visits on Nov 18 and exports on Nov 18, but their all-time first export
  // was Nov 17, outside this 1-day window.
  assert.equal(nov18.visitors, 1);
  assert.equal(nov18.firstExportUsers, 0);
  assert.equal(nov18.topupUsers, 0);
  assert.equal(nov18.conversionRate, 0);

  const nov17 = computeKpis(FIXTURE_EVENTS, {
    days: 1,
    channel: ALL_CHANNELS,
    cutoffMs: Date.parse('2026-11-18T00:00:00Z'),
  });
  assert.equal(nov17.visitors, 1);
  assert.equal(nov17.firstExportUsers, 1);
  assert.equal(nov17.topupUsers, 1);
  assert.equal(nov17.conversionRate, 1);
});

test('per-user deduplication covers visits, top-ups and exports', () => {
  const first = firstExportsByUser(FIXTURE_EVENTS);
  assert.equal(first.get('o1').event.at, '2026-11-17T13:00:00Z');

  // o1 visits twice in 7 days but counts once as a visitor.
  assert.equal(visitorSet(FIXTURE_EVENTS, filter(7)).size, 5);

  const duplicateTopups = [
    { at: '2026-11-17T09:00:00Z', user: 'u1', channel: 'Organic', type: 'visit' },
    { at: '2026-11-17T10:00:00Z', user: 'u1', channel: 'Organic', type: 'simulated_topup_success' },
    { at: '2026-11-17T11:00:00Z', user: 'u1', channel: 'Organic', type: 'simulated_topup_success' },
  ];
  assert.equal(computeKpis(duplicateTopups, filter(7)).visitors, 1);
  assert.equal(computeKpis(duplicateTopups, filter(7)).topupUsers, 1);
});

test('a top-up without a matching visit is not counted as a top-up user', () => {
  const events = [
    { at: '2026-11-17T09:00:00Z', user: 'visitor', channel: 'Organic', type: 'visit' },
    { at: '2026-11-17T10:00:00Z', user: 'topup-only', channel: 'Organic', type: 'simulated_topup_success' },
  ];
  const result = computeKpis(events, filter(7));
  assert.equal(result.visitors, 1);
  assert.equal(result.topupUsers, 0);
});

test('empty sets return zero denominators instead of NaN', () => {
  const empty = computeKpis([], filter(7));
  assert.deepEqual(
    {
      visitors: empty.visitors,
      firstExportUsers: empty.firstExportUsers,
      topupUsers: empty.topupUsers,
      conversionRate: empty.conversionRate,
      empty: empty.empty,
    },
    { visitors: 0, firstExportUsers: 0, topupUsers: 0, conversionRate: 0, empty: true },
  );
  assert.deepEqual(buildChannelRows([], filter(7)), []);
});

test('channel table is filtered by date and channel', () => {
  const all = buildChannelRows(FIXTURE_EVENTS, filter(7));
  assert.deepEqual(all.map((row) => row.channel), ['Organic', 'Referral', 'Total']);
  assert.deepEqual(
    all.map((row) => [row.visitors, row.firstExportUsers, row.topupUsers]),
    [[4, 2, 1], [1, 1, 0], [5, 3, 1]],
  );

  const organic = buildChannelRows(FIXTURE_EVENTS, filter(14, 'Organic'));
  assert.deepEqual(organic.map((row) => row.channel), ['Organic']);
  assert.deepEqual(
    [organic[0].visitors, organic[0].firstExportUsers, organic[0].topupUsers],
    [5, 3, 1],
  );
});
