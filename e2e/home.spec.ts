import { test, expect } from '@playwright/test';

test('ホーム表示 → カード → クイズ → スクリーンショット', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '古文・漢文 単語帳' })).toBeVisible();
  await page.screenshot({ path: 'e2e-results/home.png', fullPage: true });

  await page.getByRole('link', { name: 'カード' }).first().click();
  await page.getByLabel('カードをめくる').click();
  await expect(page.getByTestId('meaning')).toBeVisible();
  await page.screenshot({ path: 'e2e-results/study.png' });
  await page.getByRole('button', { name: '知ってる' }).click();

  await page.goto('/#/quiz/all-kobun');
  const choices = page.locator('.choice');
  await expect(choices).toHaveCount(4);
  await choices.first().click();
  await expect(page.getByRole('button', { name: /次へ/ })).toBeVisible();
  await page.screenshot({ path: 'e2e-results/quiz.png' });

  await page.goto('/');
  await expect(page.getByTestId('streak')).toHaveText('1');
});
