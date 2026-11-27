import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

const ROW = '#posts-body tr';
const BALANCE = '#balance-value';
const EXPORT_BUTTON = '#export-button';
const EXPORT_STATUS = '#export-status';
const WALLET_STATUS = '#wallet-status';
const STORAGE_KEY = 'reddit-archive-demo.wallet.v1';
const FILTERS_KEY = 'reddit-archive-demo.filters.v1';

function topUpButton(page, amount) {
  return page
    .locator('.wallet')
    .getByRole('button', { name: `充值 ${amount} 积分`, exact: true });
}

function confirmButton(page, amount) {
  return page
    .locator('#topup-dialog')
    .getByRole('button', { name: `确认充值 ${amount} 积分`, exact: true });
}

async function confirmTopUp(page, amount) {
  await topUpButton(page, amount).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await confirmButton(page, amount).click();
  await expect(dialog).toBeHidden();
}

async function fillDate(page, selector, value) {
  await page.locator(selector).fill(value);
  // Date inputs can commit on change; dispatch explicitly so the test does
  // not depend on the browser's blur timing.
  await page.locator(selector).dispatchEvent('change');
}

async function readDownload(download) {
  const path = await download.path();
  return readFile(path, 'utf8');
}

async function storedWallet(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
}

test('initial screen shows the archive, zero balance, and the export price up front', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.locator(BALANCE)).toHaveText('0');
  await expect(page.locator('#low-balance')).toBeVisible();
  await expect(page.locator('#low-balance')).toContainText('余额不足 3 积分');
  await expect(page.locator(ROW)).toHaveCount(15);
  await expect(page.locator('#export-price-note')).toContainText('3 积分');
  await expect(page.locator('.export-line')).toContainText('3 积分');
  await expect(page.locator('#export-button')).toContainText('3 积分');
  await expect(page.locator('#export-balance')).toHaveText('0');
  await expect(page.locator('#history-empty')).toBeVisible();
  await expect(page.locator('#topup-dialog')).toBeHidden();

  // Each synthetic subreddit has at least four visible posts.
  for (const slug of ['mossy_circuits', 'paper_tides', 'quiet_orbit']) {
    const count = await page.locator(ROW).filter({ hasText: `r/${slug}` }).count();
    expect(count, `r/${slug} row count`).toBeGreaterThanOrEqual(4);
  }

  // Required post fields are rendered.
  const featured = page.locator(ROW).filter({ hasText: '潮汐图书馆的第七层' });
  await expect(featured.locator('.cell-score')).toHaveText('689');
  await expect(featured.locator('td[data-label="赞成比例"]')).toHaveText('97%');
  await expect(featured.locator('td[data-label="评论数"]')).toHaveText('92');
  await expect(featured.locator('.cell-time')).toContainText('2026');
  await expect(featured.locator('.cell-time')).toContainText('UTC');
});

test('cancelling a top-up leaves the balance and history unchanged, even after refresh', async ({
  page,
}) => {
  await page.goto('/');
  await topUpButton(page, 10).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('只入账一次');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(dialog).toBeHidden();

  await expect(page.locator(BALANCE)).toHaveText('0');
  await expect(page.locator(WALLET_STATUS)).toContainText('已取消充值 10 积分');
  await expect(page.locator('#history-empty')).toBeVisible();
  await expect(page.locator('#transaction-list')).toBeHidden();
  // Cancelling creates no persisted wallet state at all.
  expect(await storedWallet(page)).toBeNull();

  await page.reload();
  await expect(page.locator(BALANCE)).toHaveText('0');
  await expect(page.locator('#history-empty')).toBeVisible();
});

test('a confirmed top-up credits exactly once and survives refresh', async ({ page }) => {
  await page.goto('/');
  await confirmTopUp(page, 25);

  await expect(page.locator(BALANCE)).toHaveText('25');
  await expect(page.locator('#low-balance')).toBeHidden();
  await expect(page.locator(WALLET_STATUS)).toContainText('充值成功');
  await expect(page.locator('#transaction-list .transaction')).toHaveCount(1);
  await expect(page.locator('#transaction-list')).toContainText('+25');
  await expect(page.locator('#transaction-count')).toHaveText('1 笔');

  const stored = await storedWallet(page);
  expect(stored.transactions).toHaveLength(1);
  expect(stored.transactions[0]).toMatchObject({
    type: 'topup',
    amount: 25,
    balanceAfter: 25,
  });

  await page.reload();
  await expect(page.locator(BALANCE)).toHaveText('25');
  await expect(page.locator('#transaction-list .transaction')).toHaveCount(1);
  await expect(page.locator('#transaction-list')).toContainText('+25');
});

test('filtering changes the visible rows, and export downloads exactly those rows for 3 credits', async ({
  page,
}) => {
  await page.goto('/');
  await confirmTopUp(page, 10);

  await page.locator('#search').fill('mossy');
  await fillDate(page, '#from-date', '2026-09-01');
  await fillDate(page, '#to-date', '2026-10-31');
  await page.locator('#sort').selectOption('score-desc');

  await expect(page.locator(ROW)).toHaveCount(3);
  await expect(page.locator('#match-count')).toHaveText('3');
  await expect(page.locator('.post-title')).toHaveText([
    '教程：把旧路由器改成温湿度记录仪（含逗号与引号测试："A/B, C"）',
    '"低功耗"电台，真的能撑过一周吗？',
    'Field notes: moss, copper, and a rainy weekend',
  ]);
  await expect(page.locator('#export-balance')).toHaveText('10');

  const downloadPromise = page.waitForEvent('download');
  await page.locator(EXPORT_BUTTON).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^reddit-archive-\d{8}-\d{6}\.csv$/);

  const csv = await readDownload(download);
  expect(csv.startsWith('\uFEFFsubreddit,title,created_at,score,upvote_ratio,comments\r\n')).toBe(
    true,
  );
  const lines = csv.replace(/^\uFEFF/, '').trimEnd().split('\r\n');
  expect(lines).toHaveLength(4);
  expect(csv).toContain('r/mossy_circuits');
  expect(csv).toContain('教程：把旧路由器');
  expect(csv).toContain('""A/B, C""');
  expect(csv).not.toContain('quiet_orbit');
  expect(csv).not.toContain('paper_tides');

  await expect(page.locator(EXPORT_STATUS)).toContainText('导出成功');
  await expect(page.locator(EXPORT_STATUS)).toContainText('3 行');
  await expect(page.locator(EXPORT_STATUS)).toContainText('余额 7 积分');
  await expect(page.locator(BALANCE)).toHaveText('7');
  await expect(page.locator('#export-balance')).toHaveText('7');
  await expect(page.locator('#transaction-list')).toContainText('导出扣费');
  await expect(page.locator('#transaction-list')).toContainText('-3');
  await expect(page.locator('#transaction-list')).toContainText('余额 7 积分');

  const stored = await storedWallet(page);
  expect(stored.balance).toBe(7);
  expect(stored.transactions).toHaveLength(2);
  expect(stored.transactions[1]).toMatchObject({
    type: 'export',
    amount: -3,
    balanceAfter: 7,
  });

  await page.reload();
  await expect(page.locator(BALANCE)).toHaveText('7');
  await expect(page.locator('#transaction-list .transaction')).toHaveCount(2);
});

test('chosen community, dates, and sort survive a refresh; clearing them persists too', async ({
  page,
}) => {
  await page.goto('/');

  await page.locator('#subreddit-chips [data-subreddit="mossy_circuits"]').click();
  await fillDate(page, '#from-date', '2026-09-01');
  await fillDate(page, '#to-date', '2026-10-31');
  await page.locator('#sort').selectOption('score-desc');
  await expect(page.locator(ROW)).toHaveCount(3);

  const storedFilters = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    FILTERS_KEY,
  );
  expect(storedFilters).toMatchObject({
    query: 'mossy_circuits',
    from: '2026-09-01',
    to: '2026-10-31',
    sort: 'score-desc',
  });

  await page.reload();
  await expect(page.locator('#search')).toHaveValue('mossy_circuits');
  await expect(page.locator('#from-date')).toHaveValue('2026-09-01');
  await expect(page.locator('#to-date')).toHaveValue('2026-10-31');
  await expect(page.locator('#sort')).toHaveValue('score-desc');
  await expect(
    page.locator('#subreddit-chips [data-subreddit="mossy_circuits"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(ROW)).toHaveCount(3);
  await expect(page.locator('#match-count')).toHaveText('3');
  await expect(page.locator('.post-title')).toHaveText([
    '教程：把旧路由器改成温湿度记录仪（含逗号与引号测试："A/B, C"）',
    '"低功耗"电台，真的能撑过一周吗？',
    'Field notes: moss, copper, and a rainy weekend',
  ]);

  // Clearing filters must not come back after another refresh.
  await page.locator('#clear-filters').click();
  await expect(page.locator('#search')).toHaveValue('');
  await page.reload();
  await expect(page.locator('#search')).toHaveValue('');
  await expect(page.locator('#from-date')).toHaveValue('');
  await expect(page.locator('#to-date')).toHaveValue('');
  await expect(page.locator('#sort')).toHaveValue('newest');
  await expect(page.locator(ROW)).toHaveCount(15);
});

test('empty results and insufficient balance never charge; repeated exports deduct 3 exactly', async ({
  page,
}) => {
  await page.goto('/');

  // No credits: export is refused without a transaction.
  await page.locator(EXPORT_BUTTON).click();
  await expect(page.locator(EXPORT_STATUS)).toContainText('余额不足');
  await expect(page.locator(EXPORT_STATUS)).toContainText('当前余额 0 积分');
  await expect(page.locator(BALANCE)).toHaveText('0');
  expect((await storedWallet(page))).toBeNull();

  // Empty result: no download, no charge.
  await page.locator('#search').fill('no-such-subreddit');
  await expect(page.locator(ROW)).toHaveCount(0);
  await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('.table-wrap')).toBeHidden();
  await page.locator(EXPORT_BUTTON).click();
  await expect(page.locator(EXPORT_STATUS)).toContainText('没有可导出的匹配行');
  await expect(page.locator(BALANCE)).toHaveText('0');

  // Fund the wallet, then repeat the empty export: still no charge.
  await confirmTopUp(page, 10);
  await page.locator(EXPORT_BUTTON).click();
  await expect(page.locator(EXPORT_STATUS)).toContainText('没有可导出的匹配行');
  await expect(page.locator(BALANCE)).toHaveText('10');
  await expect(page.locator('#transaction-list .transaction')).toHaveCount(1);

  // Clear to all 15 rows and export three times: 10 -> 7 -> 4 -> 1.
  await page.locator('#clear-filters').click();
  await expect(page.locator(ROW)).toHaveCount(15);

  const button = page.locator(EXPORT_BUTTON);
  for (const expectedBalance of ['7', '4', '1']) {
    await expect(button).toBeEnabled();
    const downloadPromise = page.waitForEvent('download');
    await button.click();
    await downloadPromise;
    await expect(page.locator(BALANCE)).toHaveText(expectedBalance);
  }

  // At 1 credit the fourth export is refused and nothing changes.
  await expect(button).toBeEnabled();
  await page.locator(EXPORT_BUTTON).click();
  await expect(page.locator(EXPORT_STATUS)).toContainText('余额不足');
  await expect(page.locator(EXPORT_STATUS)).toContainText('当前余额 1 积分');
  await expect(page.locator(BALANCE)).toHaveText('1');
  await expect(page.locator('#transaction-list .transaction')).toHaveCount(4);

  const stored = await storedWallet(page);
  expect(stored.balance).toBe(1);
  expect(stored.transactions.map((transaction) => transaction.amount)).toEqual([
    10, -3, -3, -3,
  ]);
  expect(
    stored.transactions
      .filter((transaction) => transaction.type === 'export')
      .map((transaction) => transaction.balanceAfter),
  ).toEqual([7, 4, 1]);
});

test.describe('390px mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('wallet, filtering, and export remain operable without horizontal overflow', async ({
    page,
  }) => {
    await page.goto('/');

    const initialMetrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(initialMetrics.scrollWidth).toBeLessThanOrEqual(initialMetrics.innerWidth);
    expect(initialMetrics.bodyWidth).toBeLessThanOrEqual(initialMetrics.innerWidth);

    const walletBox = await page.locator('.wallet').boundingBox();
    const catalogBox = await page.locator('.catalog').boundingBox();
    expect(walletBox.y).toBeLessThan(catalogBox.y);

    await confirmTopUp(page, 10);
    await page.locator('#search').fill('paper');
    await fillDate(page, '#from-date', '2026-09-01');
    await fillDate(page, '#to-date', '2026-09-30');
    await expect(page.locator(ROW)).toHaveCount(1);
    await expect(page.locator('.post-title')).toHaveText(['写作练习："一艘不靠岸的船"']);

    const downloadPromise = page.waitForEvent('download');
    await page.locator(EXPORT_BUTTON).click();
    await downloadPromise;
    await expect(page.locator(EXPORT_STATUS)).toContainText('导出成功');
    await expect(page.locator(BALANCE)).toHaveText('7');

    await expect(page.locator(ROW).first()).toBeVisible();
    const afterMetrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(afterMetrics.scrollWidth).toBeLessThanOrEqual(afterMetrics.innerWidth);
  });
});

test('keyboard alone can cancel, confirm a top-up, filter, and export', async ({ page }) => {
  await page.goto('/');

  const tenCreditButton = topUpButton(page, 10);
  await tenCreditButton.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator(BALANCE)).toHaveText('0');
  await expect(page.locator(WALLET_STATUS)).toContainText('已取消充值');

  await tenCreditButton.focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();

  const confirm = confirmButton(page, 10);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await confirm.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.locator(BALANCE)).toHaveText('10');
  await expect(page.locator(WALLET_STATUS)).toContainText('充值成功');

  const search = page.locator('#search');
  await search.focus();
  await page.keyboard.type('quiet');
  await expect(page.locator(ROW)).toHaveCount(5);

  const exportButton = page.locator(EXPORT_BUTTON);
  await exportButton.focus();
  const downloadPromise = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  await downloadPromise;
  await expect(page.locator(BALANCE)).toHaveText('7');
  await expect(page.locator(EXPORT_STATUS)).toContainText('导出成功');
});
