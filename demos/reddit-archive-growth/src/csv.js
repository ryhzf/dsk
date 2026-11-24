/** RFC 4180 CSV helpers with UTF-8 BOM for filtered downloads. */

import { ALL_CHANNELS, computeKpis, filterEvents } from './metrics.js';
import { CUTOFF_MS } from './data.js';

export const CSV_BOM = '\uFEFF';

function isoSeconds(ms) {
  return new Date(ms).toISOString().replace(/\.000Z$/, 'Z');
}

export function escapeCsvCell(value) {
  let text = value == null ? '' : String(value);
  // Neutralize spreadsheet formula injection without changing normal values.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function rowsToCsv(rows) {
  return `${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')}\r\n`;
}

function sortForCsv(events) {
  return [...events].sort((a, b) => {
    const byTime = Date.parse(a.at) - Date.parse(b.at);
    if (byTime !== 0) return byTime;
    const byUser = a.user.localeCompare(b.user);
    if (byUser !== 0) return byUser;
    return a.type.localeCompare(b.type);
  });
}

export function buildEventsCsv(events, filter = {}) {
  const rows = [['occurred_at_utc', 'user_id', 'channel', 'event_type']];
  for (const event of sortForCsv(filterEvents(events, filter))) {
    rows.push([
      isoSeconds(Date.parse(event.at)),
      event.user,
      event.channel,
      event.type,
    ]);
  }
  return CSV_BOM + rowsToCsv(rows);
}

export function buildSummaryCsv(events, filter = {}) {
  const kpis = computeKpis(events, filter);
  const iso = (ms) => isoSeconds(ms);
  const rows = [
    ['metric', 'value', 'definition'],
    ['cutoff_utc', iso(kpis.cutoffMs), '合成验收截止，固定不变'],
    ['window_start_utc', iso(kpis.windowStartMs), '窗口左边界（包含）'],
    ['window_end_utc', iso(kpis.windowEndMs), '窗口右边界（不包含）'],
    ['window_days', kpis.days, '7 / 14 / 28'],
    ['channel', kpis.channel === ALL_CHANNELS ? 'All' : kpis.channel, '夹具渠道，不自行归因'],
    ['visitors', kpis.visitors, '筛选交集内 visit 按 user 去重'],
    ['first_export_users', kpis.firstExportUsers, '全夹具每用户首次 export_success 落在交集且用户为访客'],
    ['simulated_topup_success_users', kpis.topupUsers, '筛选交集内 t 按 user 去重，且用户为访客'],
    ['visit_to_first_export_rate', kpis.conversionRate, 'first_export_users ÷ visitors，访客为 0 时为 0'],
  ];
  return CSV_BOM + rowsToCsv(rows);
}
