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

## Event CSV filter fix

The dashboard renders identically before and after this fix; the user-visible
difference is the downloaded event CSV. Both revisions were captured in the same
state: 7-day window, `Organic` channel, 1440 × 1000 desktop, light theme.

- **Before:** `voice-capture/team-baseline@c71eaf5` — the page says “共 9 条筛选事件”
  but the downloaded CSV has 11 event rows, including two `Referral` rows.
- **After:** this PR's head commit — the same download has exactly the 9 `Organic`
  events shown by the page.

| File | Meaning |
| --- | --- |
| `before-csv-filter-mismatch-7d-organic-1440.png` | Baseline page state, 7 days / Organic |
| `before-csv-filter-mismatch-7d-organic-events.csv` | Baseline download (11 events, includes `Referral`) |
| `after-csv-filter-fixed-7d-organic-1440.png` | Fixed page state, 7 days / Organic |
| `after-csv-filter-fixed-7d-organic-events.csv` | Fixed download (9 events, `Organic` only) |
