import { stat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const PROJECT_IDS = [
  'w03-first-project', 'w04-gpio-output', 'w05-gpio-input', 'w06-oled-debug', 'w07-exti-events',
  'w08-tim-timebase', 'w09-pwm', 'w10-actuators', 'w11-tim-measurement', 'w12-adc', 'w13-adc-dma',
  'w14-usart', 'w15-usart-packets', 'w16-i2c-mpu6050-id', 'w17-i2c-compare', 'w18-mpu6050',
  'w19-software-spi-w25q64', 'w20-hardware-spi-w25q64', 'w21-rtc-bkp', 'w22-pwr-wdg-flash', 'w23-capstone',
] as const;

async function manifest() {
  return JSON.parse(await readFile(join(ROOT, 'firmware/projects.json'), 'utf8')) as { projects: { id: string; path: string }[] };
}

describe('Task 8 firmware matrix', () => {
  it('locks all 21 projects in exact order with repository-relative paths', async () => {
    const projects = (await manifest()).projects;
    expect(projects).toEqual(PROJECT_IDS.map((id) => ({ id, path: `firmware/lessons/${id}` })));
  });

  it('requires every matrix project to contain CubeMX, CMake, Core and App structure', async () => {
    const projects = (await manifest()).projects;
    const issues: string[] = [];
    for (const project of projects) {
      const source = join(ROOT, project.path);
      const sourceStat = await stat(source).catch(() => undefined);
      if (!sourceStat?.isDirectory()) {
        issues.push(`${project.id}: missing project directory`);
        continue;
      }
      const iocFiles = (await readdir(source)).filter((name) => name.endsWith('.ioc'));
      if (iocFiles.length !== 1) issues.push(`${project.id}: expected exactly one .ioc, got ${iocFiles.length}`);
      for (const entry of ['CMakePresets.json', 'CMakeLists.txt']) if (!(await stat(join(source, entry)).catch(() => undefined))?.isFile()) issues.push(`${project.id}: missing file ${entry}`);
      for (const entry of ['Core', 'App']) if (!(await stat(join(source, entry)).catch(() => undefined))?.isDirectory()) issues.push(`${project.id}: missing directory ${entry}`);
    }
    expect(issues).toEqual([]);
  });
});
