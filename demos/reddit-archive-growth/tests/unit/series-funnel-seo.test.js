import assert from 'node:assert/strict';
import test from 'node:test';

import { FIXTURE_EVENTS } from '../../src/data.js';
import {
  ALL_CHANNELS,
  buildDailySeries,
  buildFunnel,
  seoGeoForWindow,
} from '../../src/metrics.js';

const filter = (days, channel = ALL_CHANNELS) => ({ days, channel });

test('7-day daily series is deduplicated by user and sums to the KPIs', () => {
  const series = buildDailySeries(FIXTURE_EVENTS, filter(7));
  assert.deepEqual(
    series.map((point) => [point.date, point.visitors, point.firstExports, point.topups]),
    [
      ['2026-11-17', 1, 1, 1],
      ['2026-11-18', 1, 0, 0],
      ['2026-11-19', 1, 1, 0],
      ['2026-11-20', 2, 1, 0],
      ['2026-11-21', 0, 0, 0],
      ['2026-11-22', 0, 0, 0],
      ['2026-11-23', 1, 0, 0],
    ],
  );
  assert.equal(series.reduce((sum, point) => sum + point.firstExports, 0), 3);
  assert.equal(series.reduce((sum, point) => sum + point.topups, 0), 1);
  // o1 visits on two days, so per-day visit rows sum to 6 while unique visitors = 5.
  assert.equal(series.reduce((sum, point) => sum + point.visitors, 0), 6);
});

test('14/28-day series keep the same first-export and boundary rules', () => {
  const fourteen = buildDailySeries(FIXTURE_EVENTS, filter(14));
  assert.equal(fourteen.length, 14);
  assert.equal(fourteen[0].date, '2026-11-10');
  assert.deepEqual(
    fourteen.find((point) => point.date === '2026-11-16'),
    { date: '2026-11-16', visitors: 1, topups: 0, firstExports: 1 },
  );
  assert.equal(fourteen.reduce((sum, point) => sum + point.firstExports, 0), 4);

  const twentyEight = buildDailySeries(FIXTURE_EVENTS, filter(28));
  assert.equal(twentyEight.length, 28);
  assert.equal(twentyEight[0].date, '2026-10-27');
  assert.deepEqual(
    twentyEight.find((point) => point.date === '2026-11-03'),
    { date: '2026-11-03', visitors: 1, topups: 0, firstExports: 0 },
  );
  assert.equal(twentyEight.reduce((sum, point) => sum + point.firstExports, 0), 4);
  assert.equal(twentyEight.some((point) => point.date === '2026-11-24'), false);
});

test('channel filter also applies to the daily series', () => {
  const organic = buildDailySeries(FIXTURE_EVENTS, filter(7, 'Organic'));
  assert.deepEqual(
    organic.map((point) => [point.date, point.visitors, point.firstExports, point.topups]),
    [
      ['2026-11-17', 1, 1, 1],
      ['2026-11-18', 1, 0, 0],
      ['2026-11-19', 1, 1, 0],
      ['2026-11-20', 1, 0, 0],
      ['2026-11-21', 0, 0, 0],
      ['2026-11-22', 0, 0, 0],
      ['2026-11-23', 1, 0, 0],
    ],
  );

  const referral = buildDailySeries(FIXTURE_EVENTS, filter(7, 'Referral'));
  assert.deepEqual(
    referral.find((point) => point.date === '2026-11-20'),
    { date: '2026-11-20', visitors: 1, topups: 0, firstExports: 1 },
  );
});

test('funnel shares use visitors as the denominator and never divide by zero', () => {
  assert.deepEqual(
    buildFunnel(FIXTURE_EVENTS, filter(7)).map((stage) => [
      stage.key,
      stage.value,
      stage.shareOfVisitors,
    ]),
    [
      ['visitors', 5, 1],
      ['topups', 1, 0.2],
      ['firstExports', 3, 0.6],
    ],
  );

  assert.deepEqual(
    buildFunnel(FIXTURE_EVENTS, filter(28, 'Organic')).map((stage) => stage.value),
    [6, 1, 3],
  );

  const empty = buildFunnel([], filter(7));
  assert.deepEqual(empty.map((stage) => stage.value), [0, 0, 0]);
  assert.deepEqual(empty.map((stage) => stage.shareOfVisitors), [0, 0, 0]);
});

test('SEO/GEO snapshot is aggregated by the same window and has a zero-denominator path', () => {
  assert.deepEqual(
    [7, 14, 28].map((days) => {
      const metrics = seoGeoForWindow(days);
      return [
        days,
        metrics.impressions,
        metrics.clicks,
        metrics.citations,
        metrics.referralVisits,
        Number(metrics.ctr.toFixed(4)),
        metrics.daysObserved,
      ];
    }),
    [
      [7, 2765, 170, 98, 72, 0.0615, 7],
      [14, 4855, 284, 152, 112, 0.0585, 14],
      [28, 7233, 387, 184, 135, 0.0535, 28],
    ],
  );

  const empty = seoGeoForWindow(7, Date.parse('2026-10-01T00:00:00Z'));
  assert.equal(empty.impressions, 0);
  assert.equal(empty.clicks, 0);
  assert.equal(empty.citations, 0);
  assert.equal(empty.referralVisits, 0);
  assert.equal(empty.ctr, 0);
  assert.equal(empty.daysObserved, 0);
});
