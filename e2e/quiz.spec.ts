import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

interface SampleItem { word: string; senses: { meanings: string[] }[] }
const sample = JSON.parse(readFileSync(existsSync('content/build/deck.json') ? 'content/build/deck.json' : 'sample/deck.json', 'utf8')) as { items: SampleItem[] };
const correctText = (word: string) => sample.items.find((i) => i.word === word)!.senses[0].meanings.slice(0, 3).join('・');

test('4 択テスト → 結果 → 解き直し', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '4 択テスト' }).first().click();
  const total = Number((await page.getByTestId('progress').innerText()).split('/')[1]);
  expect(total).toBeGreaterThanOrEqual(5);
  await expect(page.locator('.choice')).toHaveCount(4);
  await page.screenshot({ path: 'e2e-results/quiz-question.png' });

  const wrongWords: string[] = [];
  for (let k = 0; k < total; k++) {
    await expect(page.getByTestId('progress')).toHaveText(`${k + 1} / ${total}`);
    const word = (await page.locator('.quizq .word').innerText()).trim();
    const right = correctText(word);
    if (k === 0) {
      // わざと誤答
      const texts = await page.locator('.choice').allInnerTexts();
      await page.locator('.choice', { hasText: texts.find((t) => t !== right)! }).first().click();
      wrongWords.push(word);
      await expect(page.locator('.choice.wrong')).toHaveCount(1);
      await expect(page.locator('.choice.right')).toHaveText(right);
      await page.screenshot({ path: 'e2e-results/quiz-feedback.png' });
    } else if (k === 1) {
      await page.getByRole('button', { name: 'わからない', exact: true }).click();
      wrongWords.push(word);
    } else {
      await page.locator('.choice', { hasText: right }).first().click();
      await expect(page.getByTestId('mark')).toHaveText('○');
      if (k === 2) await page.screenshot({ path: 'e2e-results/quiz-correct.png' });
    }
    if (k < 2) await page.getByRole('button', { name: /次へ/ }).click();
    // 正解時は 0.8 秒で自動的に次へ（最終問のみ結果画面へ）
  }

  await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();
  await expect(page.getByTestId('result-list').locator('li')).toHaveCount(total);
  await expect(page.getByTestId('accuracy')).toHaveText(`正答率 ${Math.round(((total - 2) / total) * 100)}%`);
  await page.screenshot({ path: 'e2e-results/quiz-result.png', fullPage: true });

  await page.getByRole('button', { name: '間違えた語だけ解き直す' }).click();
  await expect(page.getByTestId('progress')).toHaveText('1 / 2');
  const seen: string[] = [];
  for (let k = 0; k < 2; k++) {
    seen.push((await page.locator('.quizq .word').innerText()).trim());
    await page.getByRole('button', { name: 'わからない', exact: true }).click();
    await page.getByRole('button', { name: /次へ/ }).click();
  }
  expect(seen.sort()).toEqual([...wrongWords].sort());
  await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();

  await page.getByRole('link', { name: '章へ戻る' }).click();
  await expect(page.getByTestId('streak')).toHaveText('1');
  await expect(page.getByText(`${total + 2}/30`)).toBeVisible();
});
