import { test, expect } from '@playwright/test';
import { data, visibleText } from './helpers';
test('カードの仕分けで苦手に入り、段階別復習と一覧で解消する', async ({ page }) => {
  await page.goto('/#/study/' + data.chapters[0].id + '?n=1');
  await page.getByRole('button', { name: 'わからなかった', exact: true }).click();
  await expect(page.getByTestId('card-result')).toBeVisible();
  await page.getByRole('link', { name: 'ホームへ' }).click();
  await expect(page.getByTestId('weak-count')).toHaveText('苦手の復習（1 問）');
  await page.getByTestId('overview').getByTestId('review-weak').click();
  await expect(page).toHaveURL(/study\/lv-weak/);
  await expect(page.getByTestId('card-progress')).toContainText('1/1');
  await page.getByRole('link', { name: '問題一覧' }).click();
  await page.getByRole('group', { name: '定着度で絞り込む' }).getByRole('button', { name: '苦手', exact: true }).click();
  await expect(page.locator('.words li.card')).toHaveCount(1);
  await page.getByRole('button', { name: '苦手から外す' }).click();
  await expect(page.locator('.words li.card')).toHaveCount(0);
});

test('一覧は問題・解答・解説・定着度を表示し検索できる', async ({ page }) => {
  await page.goto('/#/list');
  await expect(page.locator('.words li.card')).toHaveCount(data.items.length);
  const item = data.items.find(i => i.explanation)!;
  await page.getByLabel('検索', { exact: true }).fill(item.question);
  const row = page.locator('.words li.card').filter({ hasText: visibleText(item.question) }).first();
  await expect(row).toContainText(visibleText(item.answer));
  await expect(row).toContainText(visibleText(item.explanation!));
  await expect(row).toContainText('未学習');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'e2e-results/list.png', fullPage: true });
});
