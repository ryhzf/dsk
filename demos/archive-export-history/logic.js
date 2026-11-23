/**
 * 与 DOM 解耦的筛选、汇总和格式化逻辑。
 * 浏览器与 `node verify.mjs` 共用同一份实现。
 */

import { STATUS } from "./data.js";

export const ALL = "all";

/**
 * 按 subreddit 与状态过滤记录，保持传入顺序。
 * `all`、空字符串或 undefined 表示不限制。
 */
export function filterRecords(records, { subreddit = ALL, status = ALL } = {}) {
  return records.filter((record) => {
    const matchesSubreddit =
      !subreddit || subreddit === ALL || record.subreddit === subreddit;
    const matchesStatus = !status || status === ALL || record.status === status;
    return matchesSubreddit && matchesStatus;
  });
}

/** 返回按导出时间倒序排列的新数组，不修改入参。 */
export function sortRecordsByTimeDesc(records) {
  return [...records].sort(
    (left, right) => Date.parse(right.exportedAt) - Date.parse(left.exportedAt),
  );
}

export function summarize(records) {
  return records.reduce(
    (summary, record) => ({
      totalRecords: summary.totalRecords + 1,
      totalPosts: summary.totalPosts + record.postCount,
      totalDeduction: summary.totalDeduction + record.deduction,
    }),
    { totalRecords: 0, totalPosts: 0, totalDeduction: 0 },
  );
}

/** 去重后的 subreddit 列表，按字母顺序排列。 */
export function getSubreddits(records) {
  return [...new Set(records.map((record) => record.subreddit))].sort((left, right) =>
    left.localeCompare(right, "en", { sensitivity: "base" }),
  );
}

const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** 将 ISO 时间格式化为北京时间 `YYYY-MM-DD HH:mm`。 */
export function formatExportTime(isoString) {
  const parts = Object.fromEntries(
    timeFormatter
      .formatToParts(new Date(isoString))
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

const numberFormatter = new Intl.NumberFormat("zh-CN");

export function formatNumber(value) {
  return numberFormatter.format(value);
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new TypeError("seconds must be a non-negative number");
  }
  if (seconds < 60) {
    return `${seconds} 秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} 分钟` : `${minutes} 分 ${rest} 秒`;
}

export function formatRange(range) {
  if (!range?.from || !range?.to) {
    return "—";
  }
  return `${range.from} 至 ${range.to}`;
}

export function getStatusMeta(status) {
  const meta = STATUS[status];
  if (!meta) {
    throw new Error(`未知状态: ${status}`);
  }
  return meta;
}
