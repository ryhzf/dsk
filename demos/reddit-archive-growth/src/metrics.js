/**
 * Pure metric functions for the growth console.
 *
 * All acceptance metrics are derived from FIXTURE_EVENTS and the pinned cutoff.
 * The definitions are deliberately explicit because several plausible but
 * wrong readings exist (sessions vs users, any export vs first export,
 * per-window first export vs all-time first export).
 */

import { CUTOFF_MS, DAY_MS, EVENT_TYPE, SEO_GEO_DAILY } from './data.js';

export const ALL_CHANNELS = 'all';

export function cutoffMsFrom(value = CUTOFF_MS) {
  const parsed = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`Invalid cutoff: ${value}`);
  }
  return parsed;
}

export function windowStartMs(days, cutoffMs = CUTOFF_MS) {
  if (!Number.isInteger(days) || days <= 0) {
    throw new RangeError(`days must be a positive integer, received ${days}`);
  }
  return cutoffMsFrom(cutoffMs) - days * DAY_MS;
}

export function eventMs(event) {
  const parsed = Date.parse(event.at);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`Invalid event timestamp: ${event.at}`);
  }
  return parsed;
}

export function channelMatches(eventChannel, channel = ALL_CHANNELS) {
  return channel === ALL_CHANNELS || channel === eventChannel;
}

export function isInWindow(ms, days, cutoffMs = CUTOFF_MS) {
  const start = windowStartMs(days, cutoffMs);
  return ms >= start && ms < cutoffMsFrom(cutoffMs);
}

export function matchesFilter(event, filter = {}) {
  const {
    days = 7,
    channel = ALL_CHANNELS,
    cutoffMs = CUTOFF_MS,
  } = filter;
  return (
    channelMatches(event.channel, channel) &&
    isInWindow(eventMs(event), days, cutoffMs)
  );
}

export function filterEvents(events, filter = {}) {
  return events.filter((event) => matchesFilter(event, filter));
}

export function channelsIn(events) {
  const seen = [];
  for (const event of events) {
    if (!seen.includes(event.channel)) seen.push(event.channel);
  }
  return seen;
}

/**
 * First successful export per user across the *entire* fixture, not just the
 * selected window. A later export never replaces an earlier one.
 */
export function firstExportsByUser(events) {
  const first = new Map();
  for (const event of events) {
    if (event.type !== EVENT_TYPE.EXPORT) continue;
    const ms = eventMs(event);
    const existing = first.get(event.user);
    if (!existing || ms < existing.ms) {
      first.set(event.user, { ms, event });
    }
  }
  return first;
}

export function visitorSet(events, filter = {}) {
  const visitors = new Set();
  for (const event of events) {
    if (event.type === EVENT_TYPE.VISIT && matchesFilter(event, filter)) {
      visitors.add(event.user);
    }
  }
  return visitors;
}

export function topupUserSet(events, filter = {}) {
  const topups = new Set();
  for (const event of events) {
    if (event.type === EVENT_TYPE.TOPUP && matchesFilter(event, filter)) {
      topups.add(event.user);
    }
  }
  return topups;
}

export function computeKpis(events, filter = {}) {
  const days = filter.days ?? 7;
  const channel = filter.channel ?? ALL_CHANNELS;
  const cutoffMs = cutoffMsFrom(filter.cutoffMs ?? CUTOFF_MS);
  const normalizedFilter = { days, channel, cutoffMs };

  const visitors = visitorSet(events, normalizedFilter);

  // A conversion only counts when the user's all-time first export is itself
  // inside the current date/channel intersection AND the user visited inside
  // that same intersection.
  const firstExports = firstExportsByUser(events);
  let firstExportUsers = 0;
  for (const [user, first] of firstExports) {
    if (visitors.has(user) && matchesFilter(first.event, normalizedFilter)) {
      firstExportUsers += 1;
    }
  }

  // Top-ups are deduplicated by user and restricted to the visitor set.
  const topups = topupUserSet(events, normalizedFilter);
  let topupUsers = 0;
  for (const user of topups) {
    if (visitors.has(user)) topupUsers += 1;
  }

  const visitorCount = visitors.size;
  const conversionRate = visitorCount === 0 ? 0 : firstExportUsers / visitorCount;

  return {
    days,
    channel,
    cutoffMs,
    windowStartMs: windowStartMs(days, cutoffMs),
    windowEndMs: cutoffMs,
    visitors: visitorCount,
    firstExportUsers,
    topupUsers,
    conversionRate,
    empty: visitorCount === 0,
  };
}

export function buildChannelRows(events, filter = {}) {
  const days = filter.days ?? 7;
  const cutoffMs = cutoffMsFrom(filter.cutoffMs ?? CUTOFF_MS);
  const selected = filter.channel ?? ALL_CHANNELS;
  const channels = channelsIn(events);

  const visible = selected === ALL_CHANNELS
    ? channels
    : channels.filter((channel) => channel === selected);

  const rows = visible.map((channel) => ({
    channel,
    ...computeKpis(events, { days, channel, cutoffMs }),
  }));

  if (selected === ALL_CHANNELS && channels.length > 1) {
    rows.push({
      ...computeKpis(events, { days, channel: ALL_CHANNELS, cutoffMs }),
      channel: 'Total',
      total: true,
    });
  }

  return rows;
}

function utcDayKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Daily series for the trend chart. Each series is deduplicated by user:
 * - visits: unique visitor-users per UTC day
 * - topups: unique top-up users per UTC day, restricted to window visitors
 * - firstExports: users whose all-time first export falls on that UTC day and
 *   inside the current filter
 *
 * The topup / first-export daily sums therefore equal the KPI totals; the
 * visit daily sum can exceed the unique visitor KPI when one user visits on
 * several days (by design).
 */
export function buildDailySeries(events, filter = {}) {
  const kpis = computeKpis(events, filter);
  const { days, channel, cutoffMs } = kpis;
  const start = kpis.windowStartMs;
  const visitors = visitorSet(events, { days, channel, cutoffMs });
  const firstExports = firstExportsByUser(events);

  const buckets = Array.from({ length: days }, (_, index) => {
    const dayStart = start + index * DAY_MS;
    return {
      date: utcDayKey(dayStart),
      dayStart,
      visitors: new Set(),
      topups: new Set(),
      firstExports: 0,
    };
  });

  for (const event of events) {
    if (!matchesFilter(event, { days, channel, cutoffMs })) continue;
    const ms = eventMs(event);
    const index = Math.floor((ms - start) / DAY_MS);
    const bucket = buckets[index];
    if (event.type === EVENT_TYPE.VISIT) {
      bucket.visitors.add(event.user);
    } else if (event.type === EVENT_TYPE.TOPUP && visitors.has(event.user)) {
      bucket.topups.add(event.user);
    }
  }

  for (const [user, first] of firstExports) {
    if (!visitors.has(user) || !matchesFilter(first.event, { days, channel, cutoffMs })) {
      continue;
    }
    const index = Math.floor((first.ms - start) / DAY_MS);
    if (buckets[index]) buckets[index].firstExports += 1;
  }

  return buckets.map((bucket) => ({
    date: bucket.date,
    visitors: bucket.visitors.size,
    topups: bucket.topups.size,
    firstExports: bucket.firstExports,
  }));
}

/**
 * Descriptive funnel. Stage 2 (top-up) is not strictly required for stage 3
 * (export), so the UI labels the stages as non-nested observations instead of
 * pretending every conversion passed through a top-up.
 */
export function buildFunnel(events, filter = {}) {
  const kpis = computeKpis(events, filter);
  return [
    { key: 'visitors', label: '访问用户', value: kpis.visitors, base: true },
    { key: 'topups', label: '模拟充值成功用户', value: kpis.topupUsers, base: false },
    { key: 'firstExports', label: '首次成功导出用户', value: kpis.firstExportUsers, base: false },
  ].map((stage) => ({
    ...stage,
    shareOfVisitors: kpis.visitors === 0 ? 0 : stage.value / kpis.visitors,
  }));
}

export function seoGeoForWindow(days, cutoffMs = CUTOFF_MS) {
  if (!Number.isInteger(days) || days <= 0) {
    throw new RangeError(`days must be a positive integer, received ${days}`);
  }
  const start = cutoffMsFrom(cutoffMs) - days * DAY_MS;
  const end = cutoffMsFrom(cutoffMs);
  const rows = SEO_GEO_DAILY.filter((row) => {
    const ms = Date.parse(`${row.date}T00:00:00Z`);
    return ms >= start && ms < end;
  });

  const totals = rows.reduce(
    (acc, row) => ({
      impressions: acc.impressions + row.seoImpressions,
      clicks: acc.clicks + row.seoClicks,
      citations: acc.citations + row.aiCitations,
      referralVisits: acc.referralVisits + row.aiReferralVisits,
    }),
    { impressions: 0, clicks: 0, citations: 0, referralVisits: 0 },
  );

  return {
    days,
    windowStartMs: start,
    windowEndMs: end,
    daysObserved: rows.length,
    ...totals,
    ctr: totals.impressions === 0 ? 0 : totals.clicks / totals.impressions,
    rows,
  };
}
