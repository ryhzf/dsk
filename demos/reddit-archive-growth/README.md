# Voice capture · Growth Console

本地、可独立运行的合成数据增长看板。路径沿用 Issue #12 原指定的独立目录
`demos/reddit-archive-growth/`；本轮对外名称使用 **Voice capture · Growth Console**。

- 固定验收截止：`2026-11-24T00:00:00Z`
- 窗口：左闭右开 `[截止 − N 天, 截止)`，N = 7 / 14 / 28
- 数据：`src/data.js` 的 15 条固定合成事件（不接真实 Reddit、支付或生产埋点）
- Studio：现有帖子导出工作台，成功导出扣 3 积分，空结果和余额不足不扣；本 Demo 不修改 Studio
- 渠道：只使用夹具里的 `Organic` / `Referral`，不做线上归因

## 本地启动

```bash
cd demos/reddit-archive-growth
npm start
# 打开 http://127.0.0.1:4180
```

无需构建步骤，无运行时依赖；`package.json` 只用于脚本和可选的 Playwright 测试。

## 测试

```bash
cd demos/reddit-archive-growth
npm test                 # Node 内置测试：指标、边界、去重、零分母、CSV
npx playwright install chromium   # 首次运行浏览器测试时
npm run test:e2e         # Chromium：筛选联动、CSV 下载、390px 可操作
npm run test:all
```

浏览器测试使用独立端口 `4280`，不会复用或误测 `npm start` 的 `4180`。

## 当前口径

| 指标 | 分子 / 分母 |
| --- | --- |
| 访问用户 | 筛选交集内 `visit`，按 `user` 去重 |
| 首次成功导出用户 | 从整个夹具取每用户最早 `export_success`；只计落在同一日期/渠道交集且属于访客集合的用户 |
| 模拟充值成功用户 | 交集内 `simulated_topup_success`，按 `user` 去重，且用户属于访客集合 |
| 访问 → 首次导出转化率 | 首次成功导出用户 ÷ 访客；访客为 0 时为 0 |

完整的事件字典、营销/GEO/SEO 方案与上线后采集缺口见
[`docs/growth/reddit-archive.md`](../../docs/growth/reddit-archive.md)。

## 限制

- 纯本地 Demo：无真实数据、支付、认证、后端或部署。
- SEO/GEO 指标是单独标注的合成观测，不是真实搜索或 AI 引用结果。
- 本 Demo 不修改 Studio，也不把成功导出以外的尝试（空结果、余额不足）计为导出成功。
