import { records, STATUS } from "./data.js";
import {
  ALL,
  filterRecords,
  formatDuration,
  formatExportTime,
  formatNumber,
  formatRange,
  getStatusMeta,
  getSubreddits,
  sortRecordsByTimeDesc,
  summarize,
} from "./logic.js";

const sortedRecords = sortRecordsByTimeDesc(records);

const elements = {
  subredditFilter: document.querySelector("#subredditFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  resetFilters: document.querySelector("#resetFilters"),
  emptyReset: document.querySelector("#emptyReset"),
  emptyState: document.querySelector("#emptyState"),
  emptyHint: document.querySelector("#emptyHint"),
  recordList: document.querySelector("#recordList"),
  tableHeader: document.querySelector("#tableHeader"),
  resultCount: document.querySelector("#resultCount"),
  statRecords: document.querySelector("#statRecords"),
  statPosts: document.querySelector("#statPosts"),
  statDeduction: document.querySelector("#statDeduction"),
  detailDialog: document.querySelector("#detailDialog"),
  closeDetail: document.querySelector("#closeDetail"),
  detailTitle: document.querySelector("#detailTitle"),
  detailSub: document.querySelector("#detailSub"),
  detailStatus: document.querySelector("#detailStatus"),
  detailDeduction: document.querySelector("#detailDeduction"),
  detailSummary: document.querySelector("#detailSummary"),
  detailTime: document.querySelector("#detailTime"),
  detailPosts: document.querySelector("#detailPosts"),
  detailRange: document.querySelector("#detailRange"),
  detailDuration: document.querySelector("#detailDuration"),
  detailDeductions: document.querySelector("#detailDeductions"),
  detailNoDeduction: document.querySelector("#detailNoDeduction"),
  detailNote: document.querySelector("#detailNote"),
};

const state = {
  subreddit: ALL,
  status: ALL,
};

let lastDetailTrigger = null;

function isFiltered() {
  return state.subreddit !== ALL || state.status !== ALL;
}

function makeCell(className, labelText, valueText, suffixText = "") {
  const cell = document.createElement("div");
  cell.className = `cell ${className}`;

  const label = document.createElement("span");
  label.className = "cell-label";
  label.textContent = labelText;

  const value = document.createElement("span");
  value.className = "cell-value";
  value.textContent = valueText;

  cell.append(label, value);

  if (suffixText) {
    const suffix = document.createElement("span");
    suffix.className = "cell-suffix";
    suffix.textContent = suffixText;
    cell.append(suffix);
  }

  return cell;
}

function createRecordRow(record) {
  const item = document.createElement("li");
  item.className = "record";
  item.dataset.id = record.id;
  item.dataset.subreddit = record.subreddit;
  item.dataset.status = record.status;

  const timeCell = document.createElement("div");
  timeCell.className = "cell cell-time";
  const time = document.createElement("time");
  time.dateTime = record.exportedAt;
  time.textContent = formatExportTime(record.exportedAt);
  const id = document.createElement("span");
  id.className = "record-id";
  id.textContent = record.id;
  timeCell.append(time, id);

  const subredditCell = document.createElement("div");
  subredditCell.className = "cell cell-subreddit";
  const subreddit = document.createElement("span");
  subreddit.className = "subreddit-name";
  subreddit.textContent = record.subreddit;
  const range = document.createElement("span");
  range.className = "subreddit-range";
  range.textContent = formatRange(record.range);
  subredditCell.append(subreddit, range);

  const postsCell = makeCell("cell-posts", "帖子数", formatNumber(record.postCount), "篇");

  const statusCell = document.createElement("div");
  statusCell.className = "cell cell-status";
  const meta = getStatusMeta(record.status);
  const badge = document.createElement("span");
  badge.className = `badge badge-${meta.tone}`;
  badge.title = meta.description;
  badge.textContent = meta.label;
  statusCell.append(badge);

  const deductionCell = makeCell(
    "cell-deduction",
    "扣分",
    formatNumber(record.deduction),
    "分",
  );
  const deductionTone =
    record.status === "failed"
      ? "deduction-danger"
      : record.deduction > 0
        ? "deduction-warning"
        : "deduction-zero";
  deductionCell.classList.add(deductionTone);

  const actionCell = document.createElement("div");
  actionCell.className = "cell cell-action";
  const detailButton = document.createElement("button");
  detailButton.type = "button";
  detailButton.className = "button button-detail";
  detailButton.dataset.detailId = record.id;
  detailButton.setAttribute("aria-haspopup", "dialog");
  detailButton.setAttribute(
    "aria-label",
    `查看 ${record.subreddit} ${formatExportTime(record.exportedAt)} 的导出详情`,
  );
  detailButton.append(document.createTextNode("查看详情"));
  const chevron = document.createElement("span");
  chevron.className = "chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.textContent = "›";
  detailButton.append(chevron);
  actionCell.append(detailButton);

  item.append(timeCell, subredditCell, postsCell, statusCell, deductionCell, actionCell);
  return item;
}

function updateSummary(summary) {
  elements.statRecords.textContent = formatNumber(summary.totalRecords);
  elements.statPosts.textContent = formatNumber(summary.totalPosts);
  elements.statDeduction.textContent = formatNumber(summary.totalDeduction);

  elements.resultCount.textContent = isFiltered()
    ? `筛选结果 ${formatNumber(summary.totalRecords)} / ${formatNumber(sortedRecords.length)} 条`
    : `共 ${formatNumber(summary.totalRecords)} 条记录`;

  const hasResults = summary.totalRecords > 0;
  elements.recordList.hidden = !hasResults;
  elements.tableHeader.hidden = !hasResults;
  elements.emptyState.hidden = hasResults;

  if (!hasResults) {
    elements.emptyHint.textContent = `当前筛选（${state.subreddit === ALL ? "全部 Subreddit" : state.subreddit} · ${state.status === ALL ? "全部状态" : getStatusMeta(state.status).label}）下没有导出记录。清除筛选即可查看全部 ${sortedRecords.length} 条记录。`;
  }
}

function render() {
  const filtered = filterRecords(sortedRecords, state);
  const summary = summarize(filtered);

  elements.recordList.replaceChildren(...filtered.map(createRecordRow));
  updateSummary(summary);
}

function resetFilters() {
  state.subreddit = ALL;
  state.status = ALL;
  elements.subredditFilter.value = ALL;
  elements.statusFilter.value = ALL;
  render();
}

function populateFilters() {
  for (const subreddit of getSubreddits(sortedRecords)) {
    const option = document.createElement("option");
    option.value = subreddit;
    option.textContent = subreddit;
    elements.subredditFilter.append(option);
  }

  for (const [value, meta] of Object.entries(STATUS)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = meta.label;
    elements.statusFilter.append(option);
  }
}

function fillDialog(record) {
  const meta = getStatusMeta(record.status);

  elements.detailTitle.textContent = record.subreddit;
  elements.detailSub.textContent = `${record.id} · ${formatExportTime(record.exportedAt)}`;

  elements.detailStatus.className = `badge badge-${meta.tone}`;
  elements.detailStatus.textContent = meta.label;

  elements.detailDeduction.textContent = `${formatNumber(record.deduction)} 分`;
  elements.detailDeduction.className = `deduction-chip ${
    record.deduction === 0 ? "is-zero" : `is-${meta.tone}`
  }`;

  elements.detailSummary.textContent = `本次导出归档 ${formatNumber(record.postCount)} 篇帖子，用时 ${formatDuration(record.durationSeconds)}，${
    record.deduction === 0
      ? "没有扣分"
      : `扣 ${formatNumber(record.deduction)} 分`
  }。`;

  elements.detailTime.textContent = formatExportTime(record.exportedAt);
  elements.detailPosts.textContent = `${formatNumber(record.postCount)} 篇`;
  elements.detailRange.textContent = formatRange(record.range);
  elements.detailDuration.textContent = formatDuration(record.durationSeconds);
  elements.detailNote.textContent = record.note;

  elements.detailDeductions.replaceChildren();
  if (record.deductionItems.length === 0) {
    elements.detailNoDeduction.hidden = false;
    return;
  }

  elements.detailNoDeduction.hidden = true;
  for (const item of record.deductionItems) {
    const listItem = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = item.label;
    const points = document.createElement("span");
    points.className = "deduction-points";
    points.textContent = `−${formatNumber(item.points)} 分`;
    listItem.append(label, points);
    elements.detailDeductions.append(listItem);
  }
}

function openDetails(recordId, trigger) {
  const record = sortedRecords.find((entry) => entry.id === recordId);
  if (!record) {
    return;
  }
  lastDetailTrigger = trigger;
  fillDialog(record);
  elements.detailDialog.showModal();
  elements.closeDetail.focus();
}

populateFilters();
render();

elements.subredditFilter.addEventListener("change", () => {
  state.subreddit = elements.subredditFilter.value;
  render();
});

elements.statusFilter.addEventListener("change", () => {
  state.status = elements.statusFilter.value;
  render();
});

elements.resetFilters.addEventListener("click", resetFilters);
elements.emptyReset.addEventListener("click", resetFilters);

elements.recordList.addEventListener("click", (event) => {
  const trigger = event.target.closest("button[data-detail-id]");
  if (!trigger) {
    return;
  }
  openDetails(trigger.dataset.detailId, trigger);
});

elements.closeDetail.addEventListener("click", () => {
  elements.detailDialog.close();
});

elements.detailDialog.addEventListener("click", (event) => {
  if (event.target === elements.detailDialog) {
    elements.detailDialog.close();
  }
});

elements.detailDialog.addEventListener("close", () => {
  if (lastDetailTrigger) {
    lastDetailTrigger.focus();
    lastDetailTrigger = null;
  }
});
