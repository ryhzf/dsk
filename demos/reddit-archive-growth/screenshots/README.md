# Visual evidence

These are actual browser captures, not mockups.

- **Baseline:** `main@38175ce` does not contain this demo directory. The local baseline tree was served and `GET /demos/reddit-archive-growth/` returned **404**; the “before” images record that absence.
- **After:** the local demo at branch `agent/growth-console-800506b14e28` (see the PR description for the exact head commit).
- **Viewports:** 1440 × 1000 desktop and 390 × 844 mobile, same light theme, Chromium via Playwright, full-page capture.
- **States:** default 7-day / all-channel view; 14-day / Organic filtered view; 28-day mobile view.

| File | Meaning |
| --- | --- |
| `before-main-desktop-1440.png` | Baseline 404, desktop |
| `before-main-mobile-390.png` | Baseline 404, mobile |
| `after-desktop-7d-all-1440.png` | Final dashboard, 7 days / all channels, desktop |
| `after-mobile-7d-all-390.png` | Final dashboard, 7 days / all channels, mobile |
| `after-desktop-14d-organic-1440.png` | Final dashboard, 14 days / Organic filter, desktop |
| `after-mobile-28d-all-390.png` | Final dashboard, 28 days / all channels, mobile |

## Event CSV channel-filter fix (Issue #29)

Captured from the actual local server with Playwright, Chromium, 1440 × 1000,
light theme, 7-day window + Organic channel (the page value for 自然搜索).

- **Before:** `voice-capture/team-baseline@c71eaf5`; status says “共 9 条筛选事件”,
  but `before-geo-csv-7d-organic-events.csv` contains 11 events including 2
  `Referral` rows.
- **After:** this branch; the same interaction downloads
  `after-geo-csv-7d-organic-events.csv` with 9 `Organic` events and no
  `Referral` row.
- Page rendering is identical before and after (both screenshots have SHA-256
  `51604cd4d4f3cd5bcd9df9d36d9a2efb67533c0f644dfb7d5fd7685920892e15`), as
  expected: only the downloaded CSV content changes.

| File | Meaning |
| --- | --- |
| `before-geo-csv-7d-organic-1440.png` | Baseline page state after the 7d/Organic download |
| `before-geo-csv-7d-organic-events.csv` | Baseline downloaded CSV (11 rows, mixes Referral) |
| `after-geo-csv-7d-organic-1440.png` | Fixed page state after the 7d/Organic download |
| `after-geo-csv-7d-organic-events.csv` | Fixed downloaded CSV (9 Organic rows) |
