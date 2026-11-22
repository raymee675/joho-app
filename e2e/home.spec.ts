import { test, expect } from '@playwright/test';
import { data } from './helpers';
test('情報I の1デッキ、各章、白と青のモバイル画面', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '情報I 一問一答' })).toBeVisible();
  await expect(page.getByTestId('chapter-card')).toHaveCount(data.chapters.length);
  await expect(page.getByTestId('chapter-card').first()).toContainText(data.chapters[0].title);
  await expect(page.getByRole('button', { name: /古文|漢文/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'e2e-results/home.png', fullPage: true });
  await page.locator('.ch-text a').first().click();
  await expect(page.getByRole('heading', { name: new RegExp(data.chapters[0].title) })).toBeVisible();
  await expect(page.getByTestId('review-weak')).toBeDisabled();
});
test('PWA の名前、テーマ、アイコン、オフライン再読み込み', async ({ page, context }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('情報I 一問一答');
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.name).toBe('情報I 一問一答');
  expect(manifest.theme_color).toBe('#2563eb');
  for (const icon of manifest.icons) expect((await page.request.get(`/${icon.src}`)).ok()).toBe(true);
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active && navigator.serviceWorker.controller) return;
    await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '情報I 一問一答' })).toBeVisible();
  await context.setOffline(false);
});
