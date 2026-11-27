/**
 * Capture before/after evidence for the persisted archive filters.
 *
 * The same scenario is used for both revisions: choose a community, an
 * inclusive UTC date range and a sort order, then refresh. On the baseline
 * the controls reset and all 15 rows return; with the fix the selection and
 * the filtered rows are restored.
 *
 * Usage:
 *   STATE=before BASE_URL=http://127.0.0.1:4183 node scripts/capture-filter-persistence.mjs
 *   STATE=after  BASE_URL=http://127.0.0.1:4173 node scripts/capture-filter-persistence.mjs
 */

import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const STATE = process.env.STATE === 'before' ? 'before' : 'after';
const SUFFIX = STATE === 'before' ? 'filters-lost' : 'filters-restored';
const OUT_DIR = fileURLToPath(new URL('../docs/evidence/', import.meta.url));

await mkdir(OUT_DIR, { recursive: true });

async function setFilters(page) {
  await page.locator('[data-subreddit="quiet_orbit"]').click();
  await page.locator('#from-date').fill('2026-09-01');
  await page.locator('#from-date').dispatchEvent('change');
  await page.locator('#to-date').fill('2026-10-31');
  await page.locator('#to-date').dispatchEvent('change');
  await page.locator('#sort').selectOption('score-desc');
}

async function reset(page) {
  await page.goto(BASE_URL);
  await page.locator('#balance-value').waitFor({ state: 'visible' });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.locator('#balance-value').waitFor({ state: 'visible' });
}

async function capture(context, viewportName, { fullPage, scrollTo = null }) {
  const page = await context.newPage();
  await reset(page);
  await setFilters(page);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.locator('#balance-value').waitFor({ state: 'visible' });
  if (scrollTo) await page.locator(scrollTo).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `${OUT_DIR}${STATE}-team-baseline-${viewportName}-${SUFFIX}.png`,
    fullPage,
  });
  await page.close();
}

const browser = await chromium.launch();

const desktop = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  locale: 'zh-CN',
});
await capture(desktop, 'desktop', { fullPage: true });
await desktop.close();

const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
});
await capture(mobile, 'mobile', { fullPage: false, scrollTo: '#filters' });
await mobile.close();

await browser.close();
console.log(`Evidence written to ${OUT_DIR}`);
