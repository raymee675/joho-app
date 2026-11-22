import { test, expect } from '@playwright/test';
import { answerCorrectly, data, noTimer, runQuiz, visibleText } from './helpers';
test('解答・解説、誤答だけ再出題、回答数と苦手の復習', async ({ page }) => {
  await noTimer(page);
  await page.getByRole('link', { name: '4 択テスト', exact: true }).first().click();
  const total = await runQuiz(page, [0, 1]);
  await expect(page.getByTestId('accuracy')).toHaveText(`正答率 ${Math.round((total - 2) / total * 100)}%`);
  await page.screenshot({ path: 'e2e-results/quiz-result.png', fullPage: true });
  await page.getByRole('button', { name: '間違えた問題だけ解き直す' }).click();
  await expect(page.getByTestId('progress')).toHaveText('1 / 2');
  await runQuiz(page);
  await page.getByRole('link', { name: '章へ戻る' }).click();
  await expect(page.getByTestId('streak')).toHaveText('1');
  await expect(page.getByTestId('weak-count')).toBeDisabled();
  await expect(page.getByText(`${total + 2}/30`, { exact: true })).toBeVisible();
});
test('元の選択肢と○×をそのまま出す', async ({ page }) => {
  await noTimer(page);
  for (const item of [data.items.find(i => i.choices && i.answer !== '○' && i.answer !== '×'), data.items.find(i => i.answer === '○' || i.answer === '×')].filter(i => !!i)) {
    await page.goto('/');
    await page.goto(`/#/quiz/${item!.chapterId}?n=all`);
    const total = data.chapters.find(c => c.id === item!.chapterId)!.itemIds.length;
    for (let n = 0; n < total; n++) {
      await expect(page.getByTestId('progress')).toHaveText(`${n + 1} / ${total}`);
      if (await page.locator('.quizq').getAttribute('data-item-id') === item!.id) break;
      await page.getByRole('button', { name: 'わからない', exact: true }).click();
      await page.getByRole('button', { name: /次へ/ }).click();
    }
    await expect(page.locator('.choice')).toHaveText(item!.choices!.map(visibleText));
    await expect(page.locator('.quizq .word')).toHaveText(visibleText(item!.prompt ?? item!.question));
    await answerCorrectly(page);
    await expect(page.locator('.explain')).toContainText(visibleText(item!.answer));
  }
});
test('選択肢を隠す設定とタイムアウト', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('四択の選択肢を最初は隠す').check();
  await page.getByLabel('クイズの制限時間（秒）').fill('2');
  await page.getByRole('link', { name: 'ホーム', exact: true }).click();
  await page.getByRole('link', { name: '4 択テスト', exact: true }).first().click();
  await expect(page.getByRole('button', { name: '画面をタップして選択肢を表示' })).toBeVisible();
  await page.getByRole('button', { name: '画面をタップして選択肢を表示' }).click();
  await expect(page.getByRole('button', { name: '画面をタップして選択肢を表示' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /時間切れ → 次へ/ })).toBeVisible();
  await expect(page.locator('.choice.right')).toHaveCount(1);
});
