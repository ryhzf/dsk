import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

const KPI = {
  visitors: '[data-kpi="visitors"]',
  firstExport: '[data-kpi="first-export"]',
  topup: '[data-kpi="topup"]',
  conversion: '[data-kpi="conversion"]',
};

async function ready(page) {
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
}

async function choose(page, days) {
  await page.getByRole('button', { name: `${days} 天`, exact: true }).click();
  await ready(page);
}

async function downloadText(page, selector) {
  const downloadPromise = page.waitForEvent('download');
  await page.locator(selector).click();
  const download = await downloadPromise;
  const path = await download.path();
  return { name: download.suggestedFilename(), text: await readFile(path, 'utf8') };
}

test('first cut shows the fixed 7-day KPIs, channel table and synthetic-data labels', async ({
  page,
}) => {
  await page.goto('/');
  await ready(page);

  await expect(page.getByText('合成数据 · 非真实业务')).toBeVisible();
  await expect(page.getByText('2026-11-24 00:00:00 UTC')).toBeVisible();
  await expect(page.locator('.notice').getByText('成功导出扣 3 积分', { exact: true })).toBeVisible();

  await expect(page.locator(KPI.visitors)).toHaveText('5');
  await expect(page.locator(KPI.firstExport)).toHaveText('3');
  await expect(page.locator(KPI.topup)).toHaveText('1');
  await expect(page.locator(KPI.conversion)).toHaveText('60.0%');

  const rows = page.locator('#channel-body tr');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Organic');
  await expect(rows.nth(0)).toContainText('4');
  await expect(rows.nth(1)).toContainText('Referral');
  await expect(rows.nth(2)).toContainText('合计');
  await expect(page.locator('#range-label')).toContainText('2026-11-17 00:00 UTC');
  await expect(page.locator('#range-label')).toContainText('2026-11-24 00:00 UTC');
});

test('date and channel filters recalculate every KPI and the table together', async ({ page }) => {
  await page.goto('/');
  await ready(page);

  await choose(page, 14);
  await expect(page.locator(KPI.visitors)).toHaveText('6');
  await expect(page.locator(KPI.firstExport)).toHaveText('4');
  await expect(page.locator(KPI.topup)).toHaveText('1');
  await expect(page.locator(KPI.conversion)).toHaveText('66.7%');
  await expect(page.locator('#range-label')).toContainText('2026-11-10 00:00 UTC');

  await choose(page, 28);
  await expect(page.locator(KPI.visitors)).toHaveText('7');
  await expect(page.locator(KPI.firstExport)).toHaveText('4');
  await expect(page.locator(KPI.conversion)).toHaveText('57.1%');

  await page.locator('#channel-filter').selectOption('Organic');
  await ready(page);
  await expect(page.locator(KPI.visitors)).toHaveText('6');
  await expect(page.locator(KPI.firstExport)).toHaveText('3');
  await expect(page.locator(KPI.conversion)).toHaveText('50.0%');
  await expect(page.locator('#channel-body tr')).toHaveCount(1);

  await page.locator('#channel-filter').selectOption('Referral');
  await ready(page);
  await expect(page.locator(KPI.visitors)).toHaveText('1');
  await expect(page.locator(KPI.firstExport)).toHaveText('1');
  await expect(page.locator(KPI.topup)).toHaveText('0');
  await expect(page.locator(KPI.conversion)).toHaveText('100.0%');
  await expect(page.locator('#channel-body tr')).toHaveCount(1);
  await expect(page.locator('#channel-body tr')).toContainText('Referral');
});

test('filtered event CSV contains only the current intersection', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await choose(page, 7);
  await page.locator('#channel-filter').selectOption('Organic');
  await ready(page);

  const { name, text } = await downloadText(page, '#download-events');
  expect(name).toBe('growth-events-7d-organic.csv');
  expect(text.charCodeAt(0)).toBe(0xfeff);

  const lines = text.slice(1).trimEnd().split('\r\n');
  expect(lines[0]).toBe('occurred_at_utc,user_id,channel,event_type');
  expect(lines).toHaveLength(10);
  expect(text).not.toContain(',r1,');
  expect(text).not.toContain(',old1,');
  expect(text).not.toContain('2026-11-24T00:00:00Z');
  expect(text).toContain('2026-11-17T00:00:00Z,o1,Organic,visit');
  expect(text).toContain('2026-11-23T23:59:59Z,o4,Organic,visit');
});

test('summary CSV stays reproducible', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await choose(page, 14);

  const { name, text } = await downloadText(page, '#download-summary');
  expect(name).toBe('growth-metrics-14d-all.csv');
  expect(text).toContain('cutoff_utc,2026-11-24T00:00:00Z');
  expect(text).toContain('window_start_utc,2026-11-10T00:00:00Z');
  expect(text).toContain('visitors,6');
  expect(text).toContain('first_export_users,4');
  expect(text).toContain('simulated_topup_success_users,1');
  expect(text).toContain('visit_to_first_export_rate,0.6666666666666666');
});

test('390px viewport remains operable with no page-level horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await ready(page);

  await expect(page.locator(KPI.visitors)).toBeVisible();
  await expect(page.getByRole('button', { name: '14 天', exact: true })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await choose(page, 14);
  await expect(page.locator(KPI.visitors)).toHaveText('6');

  await page.locator('#channel-filter').selectOption('Referral');
  await ready(page);
  await expect(page.locator(KPI.conversion)).toHaveText('100.0%');

  const { text } = await downloadText(page, '#download-events');
  expect(text).toContain('r1,Referral');

  // The mobile card layout replaces the table header rather than requiring
  // horizontal scrolling inside the page.
  await expect(page.locator('#channel-body td[data-label="渠道"]')).toBeVisible();
  const tableOverflow = await page.evaluate(() => {
    const wrap = document.querySelector('.table-wrap');
    return wrap.scrollWidth - wrap.clientWidth;
  });
  expect(tableOverflow).toBeLessThanOrEqual(1);
});

test('trend, funnel and independent SEO/GEO metrics follow the date filter', async ({ page }) => {
  await page.goto('/');
  await ready(page);

  await expect(page.locator('.trend-col')).toHaveCount(7);
  await expect(page.locator('#trend-table-body tr')).toHaveCount(7);
  await expect(page.locator('[data-kpi="seo-impressions"]')).toHaveText('2,765');
  await expect(page.locator('[data-kpi="seo-clicks"]')).toHaveText('170');
  await expect(page.locator('[data-kpi="seo-ctr"]')).toHaveText('6.1%');
  await expect(page.locator('[data-kpi="geo-citations"]')).toHaveText('98');
  await expect(page.locator('[data-kpi="geo-referrals"]')).toHaveText('72');

  await expect(page.locator('.funnel-row[data-stage="visitors"] .funnel-value')).toContainText(
    '5 人',
  );
  await expect(page.locator('.funnel-row[data-stage="topups"] .funnel-value')).toContainText(
    '1 人',
  );
  await expect(
    page.locator('.funnel-row[data-stage="firstExports"] .funnel-value'),
  ).toContainText('3 人');

  await choose(page, 14);
  await expect(page.locator('.trend-col')).toHaveCount(14);
  await expect(page.locator('[data-kpi="seo-impressions"]')).toHaveText('4,855');
  await expect(page.locator('[data-kpi="seo-ctr"]')).toHaveText('5.8%');
  await expect(page.locator('[data-kpi="geo-citations"]')).toHaveText('152');
  await expect(page.locator('[data-kpi="geo-referrals"]')).toHaveText('112');
  await expect(page.locator('.funnel-row[data-stage="visitors"] .funnel-value')).toContainText(
    '6 人',
  );

  // Channel filtering changes event metrics but SEO/GEO are full-site figures;
  // the UI states this instead of inventing channel attribution.
  await page.locator('#channel-filter').selectOption('Referral');
  await ready(page);
  await expect(page.locator('.trend-col')).toHaveCount(14);
  await expect(page.locator('[data-kpi="seo-impressions"]')).toHaveText('4,855');
  await expect(page.locator('.funnel-row[data-stage="visitors"] .funnel-value')).toContainText(
    '1 人',
  );
  await expect(page.locator('.funnel-row[data-stage="firstExports"] .funnel-value')).toContainText(
    '1 人',
  );
  await expect(page.getByText('SEO/GEO 为全站口径，渠道筛选不适用。')).toBeVisible();
});

test('28-day mobile view keeps all sections and the trend inside the viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await ready(page);
  await choose(page, 28);

  await expect(page.locator('.trend-col')).toHaveCount(28);
  await expect(page.locator('[data-kpi="seo-impressions"]')).toHaveText('7,233');
  await expect(page.locator('.funnel-row')).toHaveCount(3);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const chartOverflow = await page.evaluate(() => {
    const chart = document.querySelector('#trend-chart');
    return chart.scrollWidth - chart.clientWidth;
  });
  expect(chartOverflow).toBeLessThanOrEqual(1);
});
