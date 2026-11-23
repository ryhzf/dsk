import assert from "node:assert/strict";
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

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("包含 12 条合成导出记录", () => {
  assert.equal(records.length, 12);
});

test("每条记录都包含必需字段且类型正确", () => {
  for (const record of records) {
    assert.match(record.id, /^exp-\d+$/, `${record.id} 的 id 格式不正确`);
    assert.ok(
      !Number.isNaN(Date.parse(record.exportedAt)),
      `${record.id} 的导出时间无法解析`,
    );
    assert.match(record.subreddit, /^r\/\S+$/, `${record.id} 的 subreddit 格式不正确`);
    assert.ok(Number.isInteger(record.postCount) && record.postCount > 0);
    assert.ok(Object.hasOwn(STATUS, record.status), `${record.id} 的状态未知`);
    assert.ok(Number.isInteger(record.deduction) && record.deduction >= 0);
    assert.ok(Number.isInteger(record.durationSeconds) && record.durationSeconds >= 0);
    assert.ok(record.range?.from && record.range?.to);
    assert.ok(Array.isArray(record.deductionItems));
    assert.ok(typeof record.note === "string" && record.note.trim().length > 0);
  }
});

test("记录 ID 唯一", () => {
  const ids = new Set(records.map((record) => record.id));
  assert.equal(ids.size, records.length);
});

test("扣分明细合计等于记录总扣分", () => {
  for (const record of records) {
    const sum = record.deductionItems.reduce((total, item) => total + item.points, 0);
    assert.equal(sum, record.deduction, `${record.id} 的扣分明细合计不一致`);
  }
});

test("状态与扣分口径一致", () => {
  for (const record of records) {
    if (record.status === "completed") {
      assert.equal(record.deduction, 0, `${record.id} 已完成但存在扣分`);
    } else {
      assert.ok(record.deduction > 0, `${record.id} 非完成状态应存在扣分`);
    }
  }
});

test("覆盖全部三种状态和至少 4 个 subreddit", () => {
  const statuses = new Set(records.map((record) => record.status));
  assert.deepEqual(statuses, new Set(Object.keys(STATUS)));
  assert.ok(getSubreddits(records).length >= 4);
});

test("记录按导出时间倒序排列", () => {
  for (let index = 1; index < records.length; index += 1) {
    const previous = Date.parse(records[index - 1].exportedAt);
    const current = Date.parse(records[index].exportedAt);
    assert.ok(previous >= current, `${records[index].id} 的时间顺序不正确`);
  }
});

test("按 subreddit 过滤只返回对应记录", () => {
  for (const subreddit of getSubreddits(records)) {
    const filtered = filterRecords(records, { subreddit });
    assert.ok(filtered.length > 0, `${subreddit} 没有匹配记录`);
    assert.ok(filtered.every((record) => record.subreddit === subreddit));
    assert.equal(
      filtered.length,
      records.filter((record) => record.subreddit === subreddit).length,
    );
  }
});

test("按状态过滤只返回对应状态", () => {
  for (const status of Object.keys(STATUS)) {
    const filtered = filterRecords(records, { status });
    assert.ok(filtered.length > 0, `${status} 没有匹配记录`);
    assert.ok(filtered.every((record) => record.status === status));
  }
});

test("组合过滤 subreddit + 状态", () => {
  const filtered = filterRecords(records, {
    subreddit: "r/webdev",
    status: "failed",
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "exp-1034");
});

test("无匹配组合返回空数组", () => {
  assert.equal(filterRecords(records, { subreddit: "r/books", status: "failed" }).length, 0);
});

test("未知 subreddit 返回空数组", () => {
  assert.equal(filterRecords(records, { subreddit: "r/not-a-subreddit" }).length, 0);
});

test("all / 空值 / 缺省筛选返回全部记录", () => {
  assert.equal(filterRecords(records, { subreddit: ALL, status: ALL }).length, records.length);
  assert.equal(filterRecords(records, {}).length, records.length);
  assert.equal(filterRecords(records, { subreddit: "", status: "" }).length, records.length);
  assert.equal(filterRecords(records).length, records.length);
});

test("汇总数量、帖子数与扣分正确", () => {
  assert.deepEqual(summarize(records), {
    totalRecords: 12,
    totalPosts: 9015,
    totalDeduction: 101,
  });
});

test("筛选后的汇总与筛选结果一致", () => {
  const filtered = filterRecords(records, { subreddit: "r/AskReddit" });
  assert.deepEqual(summarize(filtered), {
    totalRecords: 2,
    totalPosts: 2851,
    totalDeduction: 12,
  });
});

test("导出时间按北京时间格式化", () => {
  assert.equal(formatExportTime("2026-11-22T21:14:00+08:00"), "2026-11-22 21:14");
  assert.equal(formatExportTime("2026-11-22T13:14:00Z"), "2026-11-22 21:14");
});

test("用时格式化", () => {
  assert.equal(formatDuration(0), "0 秒");
  assert.equal(formatDuration(42), "42 秒");
  assert.equal(formatDuration(74), "1 分 14 秒");
  assert.equal(formatDuration(480), "8 分钟");
});

test("数字格式化带千分位", () => {
  assert.equal(formatNumber(0), "0");
  assert.equal(formatNumber(1284), "1,284");
  assert.equal(formatNumber(9015), "9,015");
});

test("导出范围格式化", () => {
  assert.equal(formatRange({ from: "2026-10-01", to: "2026-10-31" }), "2026-10-01 至 2026-10-31");
  assert.equal(formatRange(null), "—");
});

test("状态元数据包含标签与语气", () => {
  assert.equal(getStatusMeta("completed").label, "已完成");
  assert.equal(getStatusMeta("partial").label, "部分完成");
  assert.equal(getStatusMeta("failed").label, "失败");
  assert.throws(() => getStatusMeta("unknown"), /未知状态/);
});

test("subreddit 选项去重并按字母排序", () => {
  assert.deepEqual(getSubreddits(records), [
    "r/AskReddit",
    "r/books",
    "r/DataHoarder",
    "r/gamedev",
    "r/MechanicalKeyboards",
    "r/privacy",
    "r/webdev",
  ]);
});

test("排序返回新数组且不修改入参", () => {
  const shuffled = [records[2], records[0]];
  const sorted = sortRecordsByTimeDesc(shuffled);
  assert.equal(sorted[0].id, "exp-1042");
  assert.equal(sorted[1].id, "exp-1040");
  assert.equal(shuffled[0].id, "exp-1040");
});

let failures = 0;
for (const { name, run } of tests) {
  try {
    run();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
  }
}

const passed = tests.length - failures;
console.log(`\n${passed}/${tests.length} 项验证通过`);
if (failures > 0) {
  console.error(`${failures} 项验证失败`);
  process.exitCode = 1;
} else {
  console.log("全部验证通过");
}
