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

test('カード学習: スワイプで仕分け → 結果 → わからなかった問題だけ', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'カードで学習', exact: true }).first().click();
  const total = Number((await page.getByTestId('card-progress').innerText()).split('/')[1]);
  expect(total).toBeGreaterThanOrEqual(5);

  await expect(page.getByTestId('meaning')).toHaveCount(0);
  await page.screenshot({ path: 'e2e-results/cards-front.png' });

  // タップで解答と解説を表示
  await page.getByLabel('カードをめくる').click();
  await expect(page.getByTestId('meaning')).toBeVisible();
  await page.screenshot({ path: 'e2e-results/cards-back.png' });

  // 右へドラッグ中は「わかった」ラベルが出る
  const releaseRight = await drag(page, 120);
  await expect(page.locator('.stamp-ok')).not.toHaveCSS('opacity', '0');
  await page.screenshot({ path: 'e2e-results/cards-dragging.png' });
  await releaseRight();
  await expect(page.getByTestId('card-progress')).toContainText(`2/${total}`);

  // 左へ = わからなかった
  const releaseLeft = await drag(page, -150);
  await releaseLeft();
  await expect(page.getByTestId('card-progress')).toContainText(`3/${total}`);

  // 小さく動かして離したら戻る
  const releaseSmall = await drag(page, 20);
  await releaseSmall();
  await expect(page.getByTestId('card-progress')).toContainText(`3/${total}`);

  // 残りはボタン: 1 枚だけ「わからなかった」、他は「わかった」
  await page.getByRole('button', { name: 'わからなかった', exact: true }).click();
  for (let k = 4; k <= total; k++) {
    await expect(page.getByTestId('card-progress')).toContainText(`${k}/${total}`);
    await page.getByRole('button', { name: 'わかった', exact: true }).click();
  }
  await expect(page.getByTestId('card-result')).toHaveText(`わかった ${total - 2} / わからなかった 2`);
  await page.screenshot({ path: 'e2e-results/cards-result.png' });

  await page.getByRole('button', { name: 'わからなかった問題だけもう一度' }).click();
  await expect(page.getByTestId('card-progress')).toContainText('1/2');
  await page.getByRole('button', { name: 'わかった', exact: true }).click();
  await expect(page.getByTestId('card-progress')).toContainText('2/2');
  await page.getByRole('button', { name: 'わかった', exact: true }).click();
  await expect(page.getByTestId('card-result')).toHaveText('わかった 2 / わからなかった 0');
  await expect(page.getByRole('link', { name: 'ランクアップテストへ' })).toBeVisible();

  // カードでも回答数・連続日数が更新される
  await page.getByRole('link', { name: 'ホームへ' }).click();
  await expect(page.getByTestId('streak')).toHaveText('1');
  await expect(page.getByText(`${total + 2}/30`)).toBeVisible();
});
