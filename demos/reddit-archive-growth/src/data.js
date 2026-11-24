/**
 * Fixed synthetic acceptance fixture for the Voice capture · Growth Console.
 *
 * The cutoff is intentionally pinned to UTC 2026-11-24T00:00:00Z instead of
 * being derived from the browser clock. Every acceptance run must use the
 * same left-closed / right-open windows:
 *
 *   [2026-11-24T00:00:00Z - N days, 2026-11-24T00:00:00Z)
 */

export const DAY_MS = 86_400_000;
export const CUTOFF_ISO = '2026-11-24T00:00:00Z';
export const CUTOFF_MS = Date.parse(CUTOFF_ISO);
export const WINDOW_DAYS = Object.freeze([7, 14, 28]);

export const EVENT_TYPE = Object.freeze({
  VISIT: 'visit',
  TOPUP: 'simulated_topup_success',
  EXPORT: 'export_success',
});

export const EVENT_TYPE_LABELS = Object.freeze({
  visit: '访问',
  simulated_topup_success: '模拟充值成功',
  export_success: '成功导出（Studio 扣 3 积分）',
});

/**
 * 15 synthetic events, transcribed exactly from Issue #12 comment 7121551685.
 * Do not add, remove, reorder or "fix" them: the numbers in the acceptance
 * tests are derived from this list.
 */
export const FIXTURE_EVENTS = Object.freeze(
  [
    ['2026-11-17T00:00:00Z', 'o1', 'Organic', 'visit'],
    ['2026-11-17T12:00:00Z', 'o1', 'Organic', 'simulated_topup_success'],
    ['2026-11-17T13:00:00Z', 'o1', 'Organic', 'export_success'],
    ['2026-11-18T09:00:00Z', 'o1', 'Organic', 'visit'],
    ['2026-11-18T11:00:00Z', 'o1', 'Organic', 'export_success'],
    ['2026-11-19T08:00:00Z', 'o2', 'Organic', 'visit'],
    ['2026-11-19T10:00:00Z', 'o2', 'Organic', 'export_success'],
    ['2026-11-20T11:00:00Z', 'o3', 'Organic', 'visit'],
    ['2026-11-23T23:59:59Z', 'o4', 'Organic', 'visit'],
    ['2026-11-20T10:00:00Z', 'r1', 'Referral', 'visit'],
    ['2026-11-20T11:00:00Z', 'r1', 'Referral', 'export_success'],
    ['2026-11-16T23:59:58Z', 'old1', 'Organic', 'visit'],
    ['2026-11-16T23:59:59Z', 'old1', 'Organic', 'export_success'],
    ['2026-11-03T12:00:00Z', 'old2', 'Organic', 'visit'],
    ['2026-11-24T00:00:00Z', 'next1', 'Organic', 'visit'],
  ].map(([at, user, channel, type]) => Object.freeze({ at, user, channel, type })),
);

/**
 * Synthetic SEO / GEO observations, one row per UTC day, independent from the
 * product-event fixture above. These numbers are fabricated for UI wiring and
 * are never presented as real search, citation or traffic results.
 *
 * The first row deliberately has no impressions so the zero-denominator path
 * can be exercised in tests.
 */
export const SEO_GEO_DAILY = Object.freeze(
  [
    ['2026-10-27', 0, 0, 0, 0],
    ['2026-10-28', 120, 3, 0, 0],
    ['2026-10-29', 138, 4, 0, 0],
    ['2026-10-30', 145, 5, 1, 0],
    ['2026-10-31', 160, 6, 1, 1],
    ['2026-11-01', 155, 6, 2, 1],
    ['2026-11-02', 170, 7, 2, 1],
    ['2026-11-03', 180, 8, 2, 2],
    ['2026-11-04', 190, 9, 3, 2],
    ['2026-11-05', 210, 10, 3, 2],
    ['2026-11-06', 205, 9, 4, 3],
    ['2026-11-07', 220, 11, 4, 3],
    ['2026-11-08', 235, 12, 5, 4],
    ['2026-11-09', 250, 13, 5, 4],
    ['2026-11-10', 260, 14, 6, 4],
    ['2026-11-11', 275, 15, 6, 5],
    ['2026-11-12', 290, 16, 7, 5],
    ['2026-11-13', 310, 17, 8, 6],
    ['2026-11-14', 300, 15, 8, 6],
    ['2026-11-15', 320, 18, 9, 7],
    ['2026-11-16', 335, 19, 10, 7],
    ['2026-11-17', 350, 20, 10, 8],
    ['2026-11-18', 365, 21, 12, 9],
    ['2026-11-19', 380, 23, 13, 9],
    ['2026-11-20', 395, 24, 14, 10],
    ['2026-11-21', 410, 26, 15, 11],
    ['2026-11-22', 425, 27, 16, 12],
    ['2026-11-23', 440, 29, 18, 13],
  ].map(([date, seoImpressions, seoClicks, aiCitations, aiReferralVisits]) =>
    Object.freeze({ date, seoImpressions, seoClicks, aiCitations, aiReferralVisits }),
  ),
);
