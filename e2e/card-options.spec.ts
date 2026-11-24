import { test, expect } from '@playwright/test';
import { data, visibleText } from './helpers';

test('旧quiz URLはクエリを保持してカードへリダイレクト', async ({ page }) => {
  const id = data.chapters[0].id;
  await page.goto(`/#/quiz/${id}?shuffle=1&n=2`);
  await expect(page).toHaveURL(`/#/study/${id}?shuffle=1&n=2`);
  await expect(page.getByTestId('card-progress')).toContainText('1/2');
  await expect(page.getByTestId('meaning')).toHaveCount(0);
});

test('元の問題文と選択肢を表に表示し、設定で解答の初期表示を変える', async ({ page }) => {
  const item = data.items.find(i => i.choices && i.question.includes('\n')) ?? data.items[0];
  const chapter = data.chapters.find(c => c.id === item.chapterId)!;
  await page.goto(`/#/study/${item.chapterId}`);
  for (let k = 0; k < chapter.itemIds.indexOf(item.id); k++) {
    await expect(page.getByTestId('card-progress')).toContainText(`${k + 1}/${chapter.itemIds.length}`);
    await page.getByRole('button', { name: 'わかった', exact: true }).click();
  }
  await expect(page.locator('.swipe')).toHaveAttribute('data-item-id', item.id);
  await expect(page.locator('.swipe .word')).toHaveText(visibleText(item.question));
  await expect(page.getByTestId('meaning')).toHaveCount(0);
  await page.getByLabel('カードをめくる').click();
  await expect(page.locator('.sense')).toHaveText(visibleText(item.answer));
  if (item.explanation) await expect(page.locator('.answer .note')).toHaveText(visibleText(item.explanation));
  await page.getByRole('link', { name: '設定', exact: true }).click();
  await expect(page.getByText(/制限時間|四択/)).toHaveCount(0);
  await page.getByLabel('カードの正答を最初は隠す').uncheck();
  await page.getByRole('link', { name: 'ホーム', exact: true }).click();
  await page.getByRole('link', { name: 'カードで学習', exact: true }).first().click();
  await expect(page.getByTestId('meaning')).toBeVisible();
});
