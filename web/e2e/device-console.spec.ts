import { expect, test, type Page } from '@playwright/test';

async function openSimulator(page: Page, scenario: string) {
  await page.goto('/#/device');
  const safety = page.getByRole('group', { name: '连接前安全确认' });
  for (const checkbox of await safety.getByRole('checkbox').all()) {
    await checkbox.check();
  }
  await page.getByLabel('模拟场景').selectOption(scenario);
  await page.getByRole('button', { name: '使用模拟器' }).click();
  await expect(page.getByRole('status')).toContainText('模拟器已连接');
}

async function runHello(page: Page) {
  const card = page.getByRole('article', { name: '检测固件握手' });
  await card.getByRole('button', { name: '开始检测' }).click();
  return card;
}

test('simulator pass remains clearly non-physical', async ({ page }) => {
  await openSimulator(page, 'pass');
  const card = await runHello(page);
  await expect(page.getByRole('status')).toContainText('模拟结果，不能计为实机通过');
  await expect(card).toContainText('待人工确认');
});

test('simulator failed result is visible in the connection log', async ({ page }) => {
  await openSimulator(page, 'fail');
  await runHello(page);
  await expect(page.getByRole('log')).toContainText('system.hello: fail');
});

for (const scenario of [
  ['timeout', '超时'],
  ['disconnect', '断开'],
  ['malformed', '无效开发板消息'],
  ['wrong-version', '无效开发板消息'],
] as const) {
  test(`simulator ${scenario[0]} gives a recoverable error`, async ({ page }) => {
    await openSimulator(page, scenario[0]);
    await runHello(page);
    await expect(page.getByRole('alert')).toContainText(scenario[1], { timeout: 5_000 });
    await expect(page.getByRole('heading', { name: '重试前检查' })).toBeVisible();
    await expect(page.getByRole('log')).toContainText('system.hello');
  });
}
