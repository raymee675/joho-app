import { test, expect, type Page } from '@playwright/test';

async function drag(page: Page, dx: number) {
  const box = (await page.getByLabel('カードをめくる').boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 5 });
  await page.mouse.move(x + dx, y, { steps: 5 });
  return async () => { await page.mouse.up(); };
}

test('カード学習: スワイプで仕分け → 結果 → まだの問題だけ', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'カード', exact: true }).first().click();
  const total = Number((await page.getByTestId('card-progress').innerText()).split('/')[1]);
  expect(total).toBeGreaterThanOrEqual(5);

  // タップで解答と解説を表示
  await page.getByLabel('カードをめくる').click();
  await expect(page.getByTestId('meaning')).toBeVisible();
  await page.screenshot({ path: 'e2e-results/cards-back.png' });

  // 右へドラッグ中は「覚えた」ラベルが出る
  const releaseRight = await drag(page, 120);
  await expect(page.locator('.stamp-ok')).not.toHaveCSS('opacity', '0');
  await page.screenshot({ path: 'e2e-results/cards-dragging.png' });
  await releaseRight();
  await expect(page.getByTestId('card-progress')).toContainText(`2/${total}`);

  // 左へ = まだ
  const releaseLeft = await drag(page, -150);
  await releaseLeft();
  await expect(page.getByTestId('card-progress')).toContainText(`3/${total}`);

  // 小さく動かして離したら戻る
  const releaseSmall = await drag(page, 20);
  await releaseSmall();
  await expect(page.getByTestId('card-progress')).toContainText(`3/${total}`);

  // 残りはボタン: 1 枚だけ「まだ」、他は「覚えた」
  await page.getByRole('button', { name: 'まだ', exact: true }).click();
  for (let k = 4; k <= total; k++) {
    await expect(page.getByTestId('card-progress')).toContainText(`${k}/${total}`);
    await page.getByRole('button', { name: '覚えた', exact: true }).click();
  }
  await expect(page.getByTestId('card-result')).toHaveText(`覚えた ${total - 2} / まだ 2`);
  await page.screenshot({ path: 'e2e-results/cards-result.png' });

  await page.getByRole('button', { name: 'まだの問題だけもう一度' }).click();
  await expect(page.getByTestId('card-progress')).toContainText('1/2');
  await page.getByRole('button', { name: '覚えた', exact: true }).click();
  await expect(page.getByTestId('card-progress')).toContainText('2/2');
  await page.getByRole('button', { name: '覚えた', exact: true }).click();
  await expect(page.getByTestId('card-result')).toHaveText('覚えた 2 / まだ 0');
  await expect(page.getByRole('link', { name: 'この章を 4 択テスト' })).toBeVisible();

  // カードでも回答数・連続日数が更新される
  await page.getByRole('link', { name: 'ホームへ' }).click();
  await expect(page.getByTestId('streak')).toHaveText('1');
  await expect(page.getByText(`${total + 2}/30`)).toBeVisible();
});
