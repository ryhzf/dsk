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

## Channel-filter CSV evidence

- **Baseline:** `voice-capture/team-baseline@c71eaf5`, where the event download
  ignored the channel filter.
- **After:** the head commit of the Issue #25 PR (see its description for the
  exact revision).
- **Scenario:** 7-day window + Organic channel, 1440 × 1000, light theme,
  Chromium via Playwright, same local server and the same steps for both runs.
- The page renders identically before and after (both PNGs have SHA-256
  `56a9d933ad08c06b7135df40740838babc23ac1399782d7cbecf778b4eb270a6`); the
  user-visible difference is the downloaded event CSV.

| File | Meaning |
| --- | --- |
| `before-geo-csv-filter-7d-organic-1440.png` | Baseline page: status already reports 9 filtered events |
| `before-geo-csv-filter-7d-organic-events.csv` | Baseline download: header + 11 rows, including 2 Referral rows |
| `after-geo-csv-filter-7d-organic-1440.png` | Fixed page: status reports 9 filtered events |
| `after-geo-csv-filter-7d-organic-events.csv` | Fixed download: header + 9 Organic rows, no Referral |
