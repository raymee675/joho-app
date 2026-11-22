import { expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import type { Deck } from '../src/types';
export const data: Deck = JSON.parse(readFileSync(process.env.JOHO_DECK_PATH ?? (existsSync('content/build/deck.json') ? 'content/build/deck.json' : 'sample/deck.json'), 'utf8'));
export const visibleText = (s: string) => s.replace(/[\^_](\{([^}]+)\}|[a-zA-Z0-9])/g, (_, token, braced) => braced ?? token);
export async function noTimer(page: Page) {
  await page.goto('/#/settings');
  await page.getByLabel('制限時間なし', { exact: true }).check();
  await page.getByRole('link', { name: 'ホーム', exact: true }).click();
}
export async function answerCorrectly(page: Page) {
  const id = await page.locator('.quizq').getAttribute('data-item-id');
  const item = data.items.find(i => i.id === id)!;
  const answer = visibleText(item.choices && item.correctIndex !== undefined ? item.choices[item.correctIndex] : item.answer);
  const choices = await page.locator('.choice').allTextContents();
  const index = choices.findIndex(c => c === answer);
  expect(index).toBeGreaterThanOrEqual(0);
  await page.locator('.choice').nth(index).click();
  await expect(page.getByTestId('mark')).toHaveText('○');
  if (item.explanation) await expect(page.locator('.explain .note')).toHaveText(visibleText(item.explanation));
}
export async function runQuiz(page: Page, wrongAt: number[] = []) {
  await expect(page.getByTestId('progress')).toBeVisible();
  const total = Number((await page.getByTestId('progress').innerText()).split('/')[1]);
  for (let k = 0; k < total; k++) {
    await expect(page.getByTestId('progress')).toHaveText(`${k + 1} / ${total}`);
    if (wrongAt.includes(k)) await page.getByRole('button', { name: 'わからない', exact: true }).click();
    else await answerCorrectly(page);
    await page.getByRole('button', { name: /次へ/ }).click();
  }
  await expect(page.getByTestId('score')).toHaveText(`${total - wrongAt.filter(n => n < total).length} / ${total}`);
  return total;
}
