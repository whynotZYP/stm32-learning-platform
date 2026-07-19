import { expect, test } from '@playwright/test';

test('cached production site supports the core learning journey offline', async ({ context, page }) => {
  await page.goto('/#/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  await context.setOffline(true);
  await page.goto('/#/map');
  await page.reload();
  await expect(page.getByRole('heading', { name: '24 周学习地图' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('网页已离线');

  await page.goto('/#/week/1');
  await expect(page.getByRole('heading', { name: /第 1 周/ })).toBeVisible();
  await page.goto('/#/lesson/w01-foundations');
  await expect(page.getByRole('heading', { name: '电学、面包板与数制' })).toBeVisible();
  await page.goto('/#/assessment/entry-diagnostic');
  await expect(page.getByRole('heading', { name: /诊断/ })).toBeVisible();
  await page.goto('/#/report');
  await expect(page.getByRole('heading', { name: '知识掌握报告' })).toBeVisible();

  await page.goto('/#/notes');
  const note = '离线记录：GPIO 输入与上拉验证。';
  await page.getByLabel('本周笔记').fill(note);
  await page.getByRole('button', { name: '保存笔记' }).click();
  await expect(page.getByText('笔记已保存到这台设备。')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('本周笔记')).toHaveValue(note);

  await page.goto('/#/device');
  const safety = page.getByRole('group', { name: '连接前安全确认' });
  for (const checkbox of await safety.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: '使用模拟器' }).click();
  await page.getByRole('article', { name: '检测固件握手' })
    .getByRole('button', { name: '开始检测' }).click();
  await expect(page.getByText('模拟结果，不能计为实机通过')).toBeVisible();
});
