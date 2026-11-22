import { test, expect } from '@playwright/test';

const KANA = /^[ぁ-ゖァ-ヺー・]+$/;

test('漢文の章で「読みを選ぶ」テスト', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '漢文' }).click();
  await page.locator('.chapters li a[href*="/chapter/"]').first().click();
  await expect(page.getByRole('button', { name: '意味を選ぶ' })).toBeVisible();
  await page.getByRole('button', { name: '読みを選ぶ' }).click();
  await page.screenshot({ path: 'e2e-results/kanbun-chapter.png' });
  await page.getByRole('link', { name: '4 択テスト', exact: true }).click();

  const choices = page.locator('.choice');
  await expect(choices).toHaveCount(4);
  const texts = await choices.allInnerTexts();
  expect(new Set(texts).size).toBe(4);
  for (const t of texts) expect(t.trim()).toMatch(KANA);
  await expect(page.getByTestId('hint')).not.toBeEmpty();
  await page.screenshot({ path: 'e2e-results/kanbun-quiz.png' });

  // 正解の読みが赤/緑で示される
  await page.getByRole('button', { name: 'わからない', exact: true }).click();
  await expect(page.locator('.choice.right')).toHaveCount(1);
  expect((await page.locator('.choice.right').innerText()).trim()).toMatch(KANA);
});

test('漢文の章でカード学習ができる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '漢文' }).click();
  await page.locator('.chapters li a[href*="/study/"]').first().click();
  await page.getByLabel('カードをめくる').click();
  await expect(page.getByTestId('meaning')).toBeVisible();
  await page.screenshot({ path: 'e2e-results/kanbun-card.png' });
});
