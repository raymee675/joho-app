import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

interface SampleItem { word: string; reading: string | null; senses: { meanings: string[] }[] }
const sample = JSON.parse(readFileSync(existsSync('content/build/deck.json') ? 'content/build/deck.json' : 'sample/deck.json', 'utf8')) as { items: SampleItem[] };
const correctTexts = (word: string) => sample.items.filter((i) => i.word === word).map((i) => i.senses[0].meanings.slice(0, 3).join('・'));

/** 出題中の語の正解を選ぶ（同じ見出しの語が複数あれば、選択肢にある方） */
async function answerCorrectly(page: Page) {
  const word = (await page.locator('.quizq .word').innerText()).trim();
  const choices = await page.locator('.choice').allInnerTexts();
  const text = correctTexts(word).find((t) => choices.some((c) => c.trim() === t))!;
  // 部分一致だと「思う」が「思う・なつかしむ」にも当たるので、何番目の選択肢かで押す
  await page.locator('.choice').nth(choices.findIndex((c) => c.trim() === text)).click();
}

async function runQuiz(page: Page, wrongAt: number[] = []) {
  const total = Number((await page.getByTestId('progress').innerText()).split('/')[1]);
  for (let k = 0; k < total; k++) {
    await expect(page.getByTestId('progress')).toHaveText(`${k + 1} / ${total}`);
    if (wrongAt.includes(k)) {
      await page.getByRole('button', { name: 'わからない', exact: true }).click();
      await page.getByRole('button', { name: /次へ/ }).click();
    } else {
      await answerCorrectly(page);
    }
  }
  return total;
}

test('ランク: 未学習をカードで仕分け → ランクアップテスト合格 → 次のランク', async ({ page }) => {
  test.setTimeout(120_000); // カード 30 枚前後 + テスト 3 回
  await page.goto('/');
  const rank = page.getByTestId('rank');
  await expect(rank).toContainText('ランク 1');
  await expect(rank).toContainText('クリア 0 /');
  await page.screenshot({ path: 'e2e-results/rank-home.png' });

  // ① 未学習をカードで仕分け（全部「知ってる」）
  await page.getByTestId('rank-study').click();
  const n = Number((await page.getByTestId('card-progress').innerText()).split('/')[1]);
  for (let k = 1; k <= n; k++) {
    await expect(page.getByTestId('card-progress')).toContainText(`${k}/${n}`);
    await page.getByRole('button', { name: '知ってる', exact: true }).click();
  }
  await expect(page.getByTestId('card-result')).toHaveText(`知ってる ${n} / 知らない 0`);
  await page.getByRole('link', { name: 'ホームへ' }).click();
  await expect(page.getByTestId('rank-study')).toHaveCount(0);

  // ② 不合格（3 問わからない）
  await page.getByTestId('rank-test').click();
  await runQuiz(page, [0, 1, 2]);
  await expect(page.getByTestId('rank-result')).toContainText('不合格');
  await page.getByRole('link', { name: '章へ戻る' }).click();
  await expect(rank).toContainText('ランク 1');

  // ③ 合格（全問正解）
  await page.getByTestId('rank-test').click();
  await runQuiz(page);
  await expect(page.getByTestId('rank-result')).toContainText('合格！ランク 1 クリア');
  await page.screenshot({ path: 'e2e-results/rank-pass.png', fullPage: true });
  await page.getByRole('link', { name: '章へ戻る' }).click();
  await expect(rank).toContainText('ランク 2');
  await expect(rank).toContainText('クリア 1 /');
  await expect(page.getByTestId('chapter-card').first()).toContainText('クリア');
  await expect(page.getByTestId('chapter-card').nth(1)).toContainText('いまここ');
});

test('正解したけれど自信がない語を、結果画面と一覧で苦手に入れる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '4 択テスト' }).first().click();
  await runQuiz(page);
  const first = page.locator('.result-row').first();
  await first.getByRole('button', { name: '自信なし' }).click();
  await expect(first.getByRole('button', { name: '自信なし' })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'e2e-results/unsure.png', fullPage: true });
  await page.getByRole('link', { name: '章へ戻る' }).click();
  await expect(page.getByTestId('weak-count')).toHaveText('苦手の復習（1 語）');

  // 一覧: 苦手で絞り込み → 外す
  await page.goto('/#/list');
  await page.getByRole('group', { name: '定着度で絞り込む' }).getByRole('button', { name: '苦手' }).click();
  await expect(page.locator('.words li.card')).toHaveCount(1);
  await page.getByRole('button', { name: '苦手から外す' }).click();
  await expect(page.locator('.words li.card')).toHaveCount(0);
  await page.goto('/');
  await expect(page.getByTestId('weak-count')).toHaveText('苦手な語はありません');
});

test('学習記録: 回答数・目標・定着度の推移', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '4 択テスト' }).first().click();
  const total = await runQuiz(page, [0]);
  await page.getByRole('link', { name: '記録' }).click();
  await expect(page.getByRole('heading', { name: '学習記録' })).toBeVisible();
  await expect(page.getByTestId('stats-today')).toHaveText(`${total}/30`);
  await expect(page.getByTestId('stats-total')).toHaveText(String(total));
  await page.locator('.chart .hit').last().hover();
  await expect(page.locator('.tip').first()).toContainText(`回答 ${total}・正解 ${total - 1}`);
  await page.screenshot({ path: 'e2e-results/stats.png', fullPage: true });
});
