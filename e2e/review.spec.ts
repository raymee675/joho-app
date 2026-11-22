import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

interface SampleItem { word: string; senses: { meanings: string[] }[] }
const sample = JSON.parse(readFileSync(existsSync('content/build/deck.json') ? 'content/build/deck.json' : 'sample/deck.json', 'utf8')) as { items: SampleItem[] };
const correctText = (word: string) => sample.items.find((i) => i.word === word)!.senses[0].meanings.slice(0, 3).join('・');

test('誤答 → ホームの苦手数が増える → 復習テストで解消', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('weak-count')).toHaveText('苦手な語はありません');
  await expect(page.getByTestId('weak-count')).toBeDisabled();

  await page.getByRole('link', { name: '4 択テスト' }).first().click();
  const total = Number((await page.getByTestId('progress').innerText()).split('/')[1]);
  for (let k = 0; k < total; k++) {
    await expect(page.getByTestId('progress')).toHaveText(`${k + 1} / ${total}`);
    if (k === 0) {
      await page.getByRole('button', { name: 'わからない', exact: true }).click();
      await page.getByRole('button', { name: /次へ/ }).click();
    } else {
      const word = (await page.locator('.quizq .word').innerText()).trim();
      await page.locator('.choice', { hasText: correctText(word) }).first().click();
    }
  }
  await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();
  await page.getByRole('link', { name: '章へ戻る' }).click();

  const weak = page.getByTestId('weak-count');
  await expect(weak).toHaveText('苦手の復習（1 語）');
  // 全体の円グラフ: 苦手 1、正解した語は 1 段階上の うろ覚え
  const overview = page.getByTestId('overview');
  await expect(overview.locator('[data-status="weak"] b')).toHaveText('1');
  await expect(overview.locator('[data-status="vague"] b')).toHaveText(String(total - 1));
  await expect(overview.locator('[data-status="almost"] b')).toHaveText('0');
  // 章カードにも苦手が出る
  await expect(page.getByTestId('ch-summary').first()).toContainText('苦手 1');
  await page.screenshot({ path: 'e2e-results/review-home.png' });
  await weak.click();

  await expect(page.getByTestId('progress')).toHaveText('1 / 1');
  const word = (await page.locator('.quizq .word').innerText()).trim();
  await page.locator('.choice', { hasText: correctText(word) }).first().click();
  await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();
  await expect(page.getByTestId('score')).toHaveText('1 / 1');
  await page.screenshot({ path: 'e2e-results/review-result.png', fullPage: true });

  await page.getByRole('link', { name: '章へ戻る' }).click();
  await expect(page.getByTestId('weak-count')).toHaveText('苦手な語はありません');
});

test('章の画面: 円グラフと、段階を選んで復習', async ({ page }) => {
  await page.goto('/');
  await page.locator('.ch-text a').first().click();
  const pie = page.getByTestId('status-pie');
  await expect(pie.locator('[data-status="new"] b')).not.toHaveText('0');
  await expect(page.getByTestId('review-weak')).toBeDisabled();
  await page.getByRole('link', { name: '4 択テスト', exact: true }).click();
  await page.getByRole('button', { name: 'わからない', exact: true }).click();
  await page.getByRole('link', { name: '中断' }).click();
  await page.locator('.ch-text a').first().click();
  await expect(page.getByTestId('review-weak')).toHaveText('苦手1');
  await expect(page.getByTestId('review-mastered')).toBeDisabled();
  await page.screenshot({ path: 'e2e-results/chapter-pie.png', fullPage: true });
  await page.getByTestId('review-weak').click();
  await expect(page.getByTestId('progress')).toHaveText('1 / 1');
});

test('全体から段階ごとに出題（ホーム・記録）', async ({ page }) => {
  await page.goto('/');
  const levels = page.getByTestId('overview').getByTestId('level-buttons');
  for (const s of ['weak', 'vague', 'almost', 'mastered']) await expect(levels.getByTestId(`review-${s}`)).toBeDisabled();
  // 1 問目だけ解いて中断 → 正解ならうろ覚え、わからないなら苦手が 1 語
  await page.getByRole('link', { name: '4 択テスト' }).first().click();
  await page.getByRole('button', { name: 'わからない', exact: true }).click();
  await page.getByRole('link', { name: '中断' }).click();
  await expect(levels.getByTestId('review-weak')).toHaveText('苦手1');
  await page.screenshot({ path: 'e2e-results/level-buttons-home.png', fullPage: true });
  await levels.getByTestId('review-weak').click();
  await expect(page.getByTestId('progress')).toHaveText('1 / 1');

  await page.goto('/#/stats');
  const all = page.getByTestId('level-buttons');
  await expect(all.getByTestId('review-weak')).toHaveText('苦手1');
  await all.getByTestId('review-weak').click();
  await expect(page.getByTestId('progress')).toHaveText('1 / 1');
});

test('語の一覧に習得状態が出て、検索できる', async ({ page }) => {
  await page.goto('/#/list');
  const first = page.locator('.words li').first();
  await expect(first).toContainText('未学習');
  const word = (await first.locator('b').innerText()).trim();
  await page.getByLabel('検索').fill(word);
  await expect(page.locator('.words li').first()).toContainText(word);
  await page.screenshot({ path: 'e2e-results/list.png' });
});
