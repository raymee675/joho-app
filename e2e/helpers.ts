import { expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import type { Deck } from '../src/types';
export const data: Deck = JSON.parse(readFileSync(process.env.JOHO_DECK_PATH ?? (existsSync('content/build/deck.json') ? 'content/build/deck.json' : 'sample/deck.json'), 'utf8'));
export const visibleText = (s: string) => s.replace(/[\^_](\{([^}]+)\}|[a-zA-Z0-9])/g, (_, token, braced) => braced ?? token);
export async function runCards(page: Page, unknownAt: number[] = []) {
  await expect(page.getByTestId('card-progress')).toBeVisible();
  const total = Number((await page.getByTestId('card-progress').innerText()).split('/')[1]);
  for (let k = 0; k < total; k++) {
    await expect(page.getByTestId('card-progress')).toContainText(`${k + 1}/${total}`);
    await page.getByLabel('カードをめくる').click();
    await expect(page.getByTestId('meaning')).toBeVisible();
    await page.getByRole('button', { name: unknownAt.includes(k) ? 'わからなかった' : 'わかった', exact: true }).click();
  }
  await expect(page.getByTestId('card-result')).toHaveText(`わかった ${total - unknownAt.filter(n => n < total).length} / わからなかった ${unknownAt.filter(n => n < total).length}`);
  return total;
}
