/**
 * Capture the "after" screenshots used as PR evidence.
 *
 * Run `npm start` in another terminal, then:
 *   node scripts/capture-evidence.mjs
 */

import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const OUT_DIR = fileURLToPath(new URL('../docs/evidence/', import.meta.url));

await mkdir(OUT_DIR, { recursive: true });

function topUpButton(page, amount) {
  return page
    .locator('.wallet')
    .getByRole('button', { name: `充值 ${amount} 积分`, exact: true });
}

async function resetState(page) {
  await page.goto(BASE_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('networkidle');
}

async function topUp(page, amount) {
  await topUpButton(page, amount).click();
  await page
    .locator('#topup-dialog')
    .getByRole('button', { name: `确认充值 ${amount} 积分`, exact: true })
    .click();
}

async function filterAndExport(page) {
  await page.locator('#search').fill('mossy');
  await page.locator('#from-date').fill('2026-09-01');
  await page.locator('#from-date').dispatchEvent('change');
  await page.locator('#to-date').fill('2026-10-31');
  await page.locator('#to-date').dispatchEvent('change');
  await page.locator('#sort').selectOption('score-desc');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-button').click();
  await downloadPromise;
  await page.locator('#export-status').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const button = document.querySelector('#export-button');
    return button instanceof HTMLButtonElement && !button.disabled;
  });
}

const browser = await chromium.launch();

// Desktop ------------------------------------------------------------
const desktop = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  acceptDownloads: true,
  locale: 'zh-CN',
});
const page = await desktop.newPage();
await resetState(page);
await page.screenshot({
  path: `${OUT_DIR}after-desktop-initial.png`,
  fullPage: true,
});

await topUpButton(page, 10).click();
await page.screenshot({
  path: `${OUT_DIR}after-desktop-topup-dialog.png`,
});
await page
  .locator('#topup-dialog')
  .getByRole('button', { name: '取消', exact: true })
  .click();
await page
  .locator('#topup-dialog')
  .waitFor({ state: 'hidden' })
  .catch(() => {});

await topUp(page, 10);
await filterAndExport(page);
await page.screenshot({
  path: `${OUT_DIR}after-desktop-filtered-export.png`,
  fullPage: true,
});
await desktop.close();

// Mobile -------------------------------------------------------------
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
  locale: 'zh-CN',
});
const mobilePage = await mobile.newPage();
await resetState(mobilePage);
await mobilePage.screenshot({
  path: `${OUT_DIR}after-mobile-initial.png`,
});

await topUp(mobilePage, 10);
await filterAndExport(mobilePage);
await mobilePage.screenshot({
  path: `${OUT_DIR}after-mobile-filtered-export.png`,
  fullPage: true,
});
await mobile.close();

await browser.close();
console.log(`Evidence written to ${OUT_DIR}`);
