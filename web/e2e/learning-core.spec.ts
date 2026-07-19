import { expect, test, type Page } from '@playwright/test';

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-chromium') {
    expect(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth)).toBe(true);
  }
});

async function completeDiagnostic(page: Page) {
  await page.getByRole('link', { name: '继续学习' }).click();
  await page.getByRole('link', { name: '进入本周课程' }).click();
  await page.getByRole('link', { name: '进行入门诊断' }).click();
  const answers = page.getByLabel('你的回答');
  await answers.nth(0).fill('电压提供势能差，电流需要闭合回路，电阻限制电流。');
  await answers.nth(1).fill('第3位');
  await answers.nth(2).fill('A');
  await answers.nth(3).fill('记录可复现的串口数据和 LED 现象。');
  await page.getByRole('button', { name: '提交诊断' }).click();
  return page.getByRole('status');
}

test('new learner can find the full 24-week map', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '今天从这里开始' })).toBeVisible();
  await expect(page.getByText('当前：第 1 周')).toBeVisible();
  await page.getByRole('link', { name: '学习地图' }).click();
  await expect(page.getByRole('heading', { name: '24 周学习地图' })).toBeVisible();
  await expect(page.getByRole('link', { name: /第 24 周/ })).toBeVisible();
});

test('entry diagnostic saves an understandable evidence batch', async ({ page }) => {
  await page.goto('/');
  const result = await completeDiagnostic(page);
  await expect(result).toContainText('诊断记录已保存');
  await expect(result).toContainText('来源：测验');
  await expect(result).toContainText('状态：自动通过');
  await expect(result).toContainText('状态：人工确认');
});

test('a failed Phase 1 gate explains recovery without hiding week 5', async ({ page }) => {
  await page.goto('/#/report');
  await expect(page.getByRole('heading', { name: '知识掌握报告' })).toBeVisible();
  await expect(page.getByText('阶段平均分 ≥ 75')).toBeVisible();
  await expect(page.getByText('实操平均分 ≥ 70')).toBeVisible();
  await expect(page.getByText('每个前置标签 ≥ 70')).toBeVisible();
  await expect(page.getByText(/阶段平均分 0/)).toBeVisible();
  await expect(page.getByRole('heading', { name: '优先补强' })).toBeVisible();
  await expect(page.getByRole('list', { name: '补强队列' }).getByRole('listitem')).toHaveCount(3);
  await page.getByRole('link', { name: /预览第 5 周/ }).click();
  await expect(page.getByRole('heading', { name: '第 5 周' })).toBeVisible();
});

test('notes, backup export, local reset, and restore work together', async ({ page }) => {
  await page.goto('/');
  await completeDiagnostic(page);
  await page.goto('/#/');
  await page.getByRole('button', { name: '采用第 5 周建议' }).click();
  await expect(page.getByText('当前：第 5 周')).toBeVisible();
  await page.getByRole('link', { name: '笔记与备份' }).click();
  await expect(page.getByText('当前导出：第 5 周')).toBeVisible();
  const note = 'GPIO 输入实验：按键与上拉电阻验证完成。';
  await page.getByLabel('本周笔记').fill(note);
  await page.getByRole('button', { name: '保存笔记' }).click();
  await expect(page.getByRole('status')).toContainText('笔记已保存');
  await page.reload();
  await expect(page.getByLabel('本周笔记')).toHaveValue(note);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出全部进度' }).click();
  const backup = await downloadPromise;
  const backupPath = await backup.path();
  if (!backupPath) throw new Error('未能读取下载的备份文件');

  await page.goto('/@vite/client');
  await page.evaluate(async () => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('stm32-learning-platform');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('测试数据库仍被占用'));
  }));
  await page.goto('/#/notes');
  await expect(page.getByText('当前导出：第 1 周')).toBeVisible();
  await expect(page.getByLabel('本周笔记')).toHaveValue('');
  await page.getByLabel('导入备份').setInputFiles(backupPath);
  await expect(page.getByRole('status')).toContainText('备份文件已验证');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '恢复已选备份' }).click();
  await expect(page.getByRole('status')).toContainText('备份已恢复');
  await expect(page.getByText('当前导出：第 5 周')).toBeVisible();
  await expect(page.getByLabel('本周笔记')).toHaveValue(note);
});
