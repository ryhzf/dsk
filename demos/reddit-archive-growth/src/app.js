import { FIXTURE_EVENTS, CUTOFF_MS } from './data.js';
import {
  ALL_CHANNELS,
  buildChannelRows,
  channelsIn,
  computeKpis,
  filterEvents,
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
  downloadCsv(buildEventsCsv(FIXTURE_EVENTS, filter), filename('events'));
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
