import { FIXTURE_EVENTS, CUTOFF_MS } from './data.js';
import {
  ALL_CHANNELS,
  buildChannelRows,
  buildDailySeries,
  buildFunnel,
  channelsIn,
  computeKpis,
  filterEvents,
  seoGeoForWindow,
} from './metrics.js';
import { buildEventsCsv, buildSummaryCsv } from './csv.js';
import { formatInteger, formatPercent, formatUtcRange } from './format.js';

const state = {
  days: 7,
  channel: ALL_CHANNELS,
};

const elements = {
  channelFilter: document.querySelector('#channel-filter'),
  channelBody: document.querySelector('#channel-body'),
  emptyState: document.querySelector('#empty-state'),
  filterStatus: document.querySelector('#filter-status'),
  downloadStatus: document.querySelector('#download-status'),
  rangeLabel: document.querySelector('#range-label'),
  downloadEvents: document.querySelector('#download-events'),
  downloadSummary: document.querySelector('#download-summary'),
  windowButtons: [...document.querySelectorAll('[data-days]')],
  kpiVisitors: document.querySelector('[data-kpi="visitors"]'),
  kpiFirstExport: document.querySelector('[data-kpi="first-export"]'),
  kpiTopup: document.querySelector('[data-kpi="topup"]'),
  kpiConversion: document.querySelector('[data-kpi="conversion"]'),
  trendChart: document.querySelector('#trend-chart'),
  trendTableBody: document.querySelector('#trend-table-body'),
  trendRange: document.querySelector('#trend-range'),
  trendNote: document.querySelector('#trend-note'),
  funnel: document.querySelector('#funnel'),
  funnelRange: document.querySelector('#funnel-range'),
  seoGeoRange: document.querySelector('#seo-geo-range'),
  seoImpressions: document.querySelector('[data-kpi="seo-impressions"]'),
  seoClicks: document.querySelector('[data-kpi="seo-clicks"]'),
  seoCtr: document.querySelector('[data-kpi="seo-ctr"]'),
  geoCitations: document.querySelector('[data-kpi="geo-citations"]'),
  geoReferrals: document.querySelector('[data-kpi="geo-referrals"]'),
};

function populateChannels() {
  for (const channel of channelsIn(FIXTURE_EVENTS)) {
    const option = document.createElement('option');
    option.value = channel;
    option.textContent = channel;
    elements.channelFilter.append(option);
  }
}

function currentFilter() {
  return { days: state.days, channel: state.channel };
}

function channelLabel() {
  return state.channel === ALL_CHANNELS ? '全部渠道' : state.channel;
}

function syncControls() {
  for (const button of elements.windowButtons) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.days) === state.days));
  }
  elements.channelFilter.value = state.channel;
}

function cell(label, value, className = '') {
  const td = document.createElement('td');
  td.dataset.label = label;
  td.textContent = value;
  if (className) td.className = className;
  return td;
}

function renderTable(rows) {
  elements.channelBody.replaceChildren();

  if (rows.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'empty-row';
    td.textContent = '当前筛选没有可展示的渠道数据';
    tr.append(td);
    elements.channelBody.append(tr);
    return;
  }

  for (const row of rows) {
    const tr = document.createElement('tr');
    if (row.total) tr.className = 'total-row';
    const name = document.createElement('td');
    name.dataset.label = '渠道';
    name.className = 'channel-name';
    name.textContent = row.channel === 'Total' ? '合计' : row.channel;
    tr.append(
      name,
      cell('访问用户', formatInteger(row.visitors)),
      cell('首次成功导出', formatInteger(row.firstExportUsers)),
      cell('模拟充值成功', formatInteger(row.topupUsers)),
      cell('转化率', formatPercent(row.conversionRate)),
    );
    elements.channelBody.append(tr);
  }
}

function renderTrend(kpis) {
  const series = buildDailySeries(FIXTURE_EVENTS, currentFilter());
  const maxVisits = Math.max(1, ...series.map((point) => point.visitors));
  const totalVisits = series.reduce((sum, point) => sum + point.visitors, 0);
  const chart = document.createElement('div');
  chart.className = 'trend-plot';
  chart.style.setProperty('--days', String(series.length));
  chart.setAttribute('aria-hidden', 'true');

  for (const point of series) {
    const col = document.createElement('div');
    col.className = 'trend-col';

    const bars = document.createElement('div');
    bars.className = 'trend-bars';
    for (const [type, value] of [
      ['visits', point.visitors],
      ['first-exports', point.firstExports],
      ['topups', point.topups],
    ]) {
      const bar = document.createElement('span');
      bar.className = `bar ${type}`;
      bar.style.height = `${(value / maxVisits) * 100}%`;
      bar.title = `${point.date}：${type === 'visits' ? '访问' : type === 'first-exports' ? '首次导出' : '模拟充值'} ${value}`;
      bars.append(bar);
    }

    const tick = document.createElement('span');
    tick.className = 'trend-tick';
    tick.textContent = series.length >= 28 ? point.date.slice(8) : point.date.slice(5);
    tick.title = point.date;
    col.append(bars, tick);
    chart.append(col);
  }

  elements.trendChart.replaceChildren(chart);
  elements.trendChart.setAttribute(
    'aria-label',
    `${series.length} 天每日趋势：按日去重访问合计 ${totalVisits} 人次，首次成功导出合计 ${kpis.firstExportUsers} 人，模拟充值成功合计 ${kpis.topupUsers} 人`,
  );
  elements.trendNote.textContent =
    `柱高按每日最高访问 ${maxVisits} 人缩放；访问按日去重，同一用户多日访问会在日合计中重复。`;
  elements.trendRange.textContent = `${formatUtcRange(kpis.windowStartMs, kpis.windowEndMs)}（左闭右开）`;

  elements.trendTableBody.replaceChildren();
  for (const point of series) {
    const tr = document.createElement('tr');
    tr.append(
      cell('UTC 日期', point.date),
      cell('访问用户', formatInteger(point.visitors)),
      cell('首次成功导出', formatInteger(point.firstExports)),
      cell('模拟充值成功', formatInteger(point.topups)),
    );
    elements.trendTableBody.append(tr);
  }
}

function renderFunnel(kpis) {
  const stages = buildFunnel(FIXTURE_EVENTS, currentFilter());
  elements.funnel.replaceChildren();

  for (const stage of stages) {
    const row = document.createElement('div');
    row.className = 'funnel-row';
    row.dataset.stage = stage.key;

    const label = document.createElement('div');
    label.className = 'funnel-label';
    label.textContent = stage.label;
    const hint = document.createElement('span');
    hint.textContent = stage.base ? '分母' : '相对访客';
    label.append(hint);

    const track = document.createElement('div');
    track.className = 'funnel-track';
    const fill = document.createElement('span');
    fill.className = 'funnel-fill';
    fill.style.width = `${stage.shareOfVisitors * 100}%`;
    track.append(fill);

    const value = document.createElement('div');
    value.className = 'funnel-value';
    value.textContent = `${formatInteger(stage.value)} 人`;
    const share = document.createElement('small');
    share.textContent = `${formatPercent(stage.shareOfVisitors)} / 访客`;
    value.append(share);

    row.append(label, track, value);
    elements.funnel.append(row);
  }

  elements.funnelRange.textContent =
    `${formatUtcRange(kpis.windowStartMs, kpis.windowEndMs)}（左闭右开）`;
}

function renderSeoGeo(kpis) {
  const metrics = seoGeoForWindow(state.days, kpis.cutoffMs);
  elements.seoImpressions.textContent = formatInteger(metrics.impressions);
  elements.seoClicks.textContent = formatInteger(metrics.clicks);
  elements.seoCtr.textContent = formatPercent(metrics.ctr);
  elements.geoCitations.textContent = formatInteger(metrics.citations);
  elements.geoReferrals.textContent = formatInteger(metrics.referralVisits);
  elements.seoGeoRange.textContent =
    `${formatUtcRange(metrics.windowStartMs, metrics.windowEndMs)}（左闭右开）`;
}

function render() {
  const kpis = computeKpis(FIXTURE_EVENTS, currentFilter());
  const range = formatUtcRange(kpis.windowStartMs, kpis.windowEndMs);

  elements.kpiVisitors.textContent = formatInteger(kpis.visitors);
  elements.kpiFirstExport.textContent = formatInteger(kpis.firstExportUsers);
  elements.kpiTopup.textContent = formatInteger(kpis.topupUsers);
  elements.kpiConversion.textContent = formatPercent(kpis.conversionRate);
  elements.rangeLabel.textContent = `${range}（左闭右开）`;
  elements.emptyState.hidden = !kpis.empty;

  elements.filterStatus.textContent =
    `当前筛选：${channelLabel()} · ${state.days} 天 · ${range}（不含右端）` +
    ` · 访客 ${kpis.visitors} 人 · 首次成功导出 ${kpis.firstExportUsers} 人`;

  renderTable(
    buildChannelRows(FIXTURE_EVENTS, currentFilter()).map((row) => ({
      ...row,
      channel: row.total ? 'Total' : row.channel,
    })),
  );
  renderTrend(kpis);
  renderFunnel(kpis);
  renderSeoGeo(kpis);

  document.body.dataset.ready = 'true';
  document.body.dataset.days = String(state.days);
  document.body.dataset.channel = state.channel;
}

function filename(kind) {
  const channel = state.channel === ALL_CHANNELS ? 'all' : state.channel.toLowerCase();
  return `growth-${kind}-${state.days}d-${channel}.csv`;
}

function downloadCsv(text, name) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadEvents() {
  const filter = currentFilter();
  const count = filterEvents(FIXTURE_EVENTS, filter).length;
  downloadCsv(buildEventsCsv(FIXTURE_EVENTS, { days: filter.days }), filename('events'));
  elements.downloadStatus.textContent = `已生成 ${filename('events')}，共 ${count} 条筛选事件。`;
}

function downloadSummary() {
  downloadCsv(buildSummaryCsv(FIXTURE_EVENTS, currentFilter()), filename('metrics'));
  elements.downloadStatus.textContent = `已生成 ${filename('metrics')}，包含窗口、渠道与 4 项核心指标。`;
}

for (const button of elements.windowButtons) {
  button.addEventListener('click', () => {
    state.days = Number(button.dataset.days);
    elements.downloadStatus.textContent = '';
    syncControls();
    render();
  });
}

elements.channelFilter.addEventListener('change', (event) => {
  state.channel = event.target.value;
  elements.downloadStatus.textContent = '';
  render();
});

elements.downloadEvents.addEventListener('click', downloadEvents);
elements.downloadSummary.addEventListener('click', downloadSummary);

populateChannels();
syncControls();
render();

// The pinned cutoff is shown in the acceptance notice; this assertion protects
// future edits from silently switching the page to the browser clock.
if (CUTOFF_MS !== Date.parse('2026-11-24T00:00:00Z')) {
  throw new Error('The acceptance cutoff must stay pinned to 2026-11-24T00:00:00Z');
}
