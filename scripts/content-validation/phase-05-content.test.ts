import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const REQUIRED_HEADINGS = [
  '学完后能解释', '学完后能做到', '概念模型', 'CubeMX 为什么这样配', '最小实验',
  '调试与寄存器观察', '故障注入', '复述检查', '学习笔记', '资料来源',
] as const;
const WEEKS = [
  { week: 17, suffix: 'w17', id: 'w17-i2c-implementations', lab: 'lab-w17-i2c-compare', assessment: 'assessment-w17', sources: ['33', '34'], project: 'w17-i2c-compare' },
  { week: 18, suffix: 'w18', id: 'w18-mpu6050', lab: 'lab-w18-mpu6050', assessment: 'assessment-w18', sources: ['35'], project: 'w18-mpu6050' },
  { week: 19, suffix: 'w19', id: 'w19-spi-basics', lab: 'lab-w19-software-spi', assessment: 'assessment-w19', sources: ['36', '37', '38'], project: 'w19-software-spi-w25q64' },
  { week: 20, suffix: 'w20', id: 'w20-hardware-spi', lab: 'lab-w20-hardware-spi', assessment: 'assessment-w20', sources: ['39', '40'], project: 'w20-hardware-spi-w25q64' },
] as const;

async function text(path: string) { return readFile(join(ROOT, path), 'utf8'); }
async function json(path: string): Promise<any> { return JSON.parse(await text(path)); }
function totals(items: any[]) {
  return Object.fromEntries(['concept', 'configuration', 'practical', 'reflection'].map((kind) =>
    [kind, items.filter((item) => item.kind === kind).reduce((sum, item) => sum + item.maxScore, 0)]));
}
function checkEvidence(record: any) {
  expect(record.detectionChecks.map((item: any) => item.mode).sort()).toEqual(['automatic', 'manual', 'semi-automatic']);
  for (const check of record.detectionChecks) {
    if (!check.applicable) expect(check.reason.trim()).not.toBe('');
    if (check.evidenceSource === 'simulator') expect(check.physicalHardware).toBe(false);
  }
}

function findHostCompiler(): string {
  const candidates = [process.env.HOST_CC, 'clang', 'gcc', 'cc', 'tcc']
    .filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    if ((candidate.includes('\\') || candidate.includes('/')) && !existsSync(candidate)) continue;
    const probe = spawnSync(candidate, /^tcc(?:\.exe)?$/i.test(basename(candidate)) ? ['-v'] : ['--version'], { encoding: 'utf8' });
    if (probe.status === 0) return candidate;
  }
  throw new Error('No portable host C compiler found. Install clang/gcc/tcc or set HOST_CC.');
}

function compileAndRunHostBehavior(mutateFixedAddress = false) {
  const compiler = findHostCompiler();
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'phase-05-host-'));
  const executable = join(temporaryDirectory, process.platform === 'win32' ? 'phase-05-host.exe' : 'phase-05-host');
  const sourcePaths = [
    join(ROOT, 'scripts/content-validation/phase-05-host-behavior.c'),
    join(ROOT, 'firmware/lessons/w17-i2c-compare/App/i2c_bitbang.c'),
    join(ROOT, 'firmware/lessons/w18-mpu6050/App/mpu6050_logic.c'),
    join(ROOT, 'firmware/lessons/w19-software-spi-w25q64/App/soft_spi.c'),
    join(ROOT, 'firmware/shared/w25q64_logic.c'),
  ];
  const includeDirectories = [
    'firmware/lessons/w17-i2c-compare/App',
    'firmware/lessons/w18-mpu6050/App',
    'firmware/lessons/w19-software-spi-w25q64/App',
    'firmware/shared',
  ];
  try {
    if (mutateFixedAddress) {
      const index = sourcePaths.length - 1;
      const production = readFileSync(sourcePaths[index], 'utf8');
      const mutation = production.replace('W25Q64_TEST_SECTOR_ADDRESS = 0x007FF000U', 'W25Q64_TEST_SECTOR_ADDRESS = 0x00000000U');
      expect(mutation).not.toBe(production);
      sourcePaths[index] = join(temporaryDirectory, 'w25q64_logic.c');
      writeFileSync(sourcePaths[index], mutation, 'utf8');
    }
    const flags = /^tcc(?:\.exe)?$/i.test(basename(compiler)) ? [] : ['-std=c11', '-Wall', '-Wextra', '-Werror'];
    const includeArguments = includeDirectories.flatMap((directory) => ['-I', join(ROOT, directory)]);
    const compile = spawnSync(compiler, [...flags, ...includeArguments, ...sourcePaths, '-o', executable], { encoding: 'utf8' });
    expect(compile.status, `${compile.stdout}\n${compile.stderr}`).toBe(0);
    return spawnSync(executable, [], { encoding: 'utf8' });
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

describe('phase 5 curriculum contract', () => {
  it('uses the fixed IDs, source groups, ten headings and honest evidence contracts', async () => {
    for (const spec of WEEKS) {
      const week = await json(`curriculum/weeks/${spec.suffix}.json`);
      const page = await text(`curriculum/weeks/${spec.suffix}.md`);
      const lab = await json(`labs/manifests/${spec.lab}.json`);
      const assessment = await json(`assessments/question-banks/${spec.assessment}.json`);
      expect(week).toMatchObject({ id: spec.id, week: spec.week, sourceCourseIds: spec.sources, labIds: [spec.lab], assessmentId: spec.assessment });
      expect(lab).toMatchObject({ id: spec.lab, lessonId: spec.id, firmwareProject: `firmware/lessons/${spec.project}` });
      expect(assessment).toMatchObject({ id: spec.assessment, lessonId: spec.id });
      expect(totals(assessment.items)).toEqual({ concept: 25, configuration: 25, practical: 35, reflection: 15 });
      expect([...page.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1])).toEqual(REQUIRED_HEADINGS);
      expect(page.length).toBeGreaterThan(1800);
      expect(page).toMatch(/https:\/\/[^\s)]*st\.com/i);
      expect(page).toMatch(/访问日期：\d{4}-\d{2}-\d{2}/);
      expect(page).toMatch(/断电/);
      checkEvidence(week);
      checkEvidence(lab);
      for (const entry of [`${spec.project}.ioc`, 'CMakeLists.txt', 'CMakePresets.json', 'Core/Src/main.c', 'App/app.c', 'App/app.h']) {
        expect((await stat(join(ROOT, 'firmware/lessons', spec.project, entry))).isFile()).toBe(true);
      }
    }
    const gate = await json('assessments/practicals/gate-05.json');
    expect(gate).toMatchObject({ id: 'gate-05', phase: 5, lessonIds: WEEKS.map((item) => item.id) });
    expect(totals(gate.items)).toEqual({ concept: 25, configuration: 25, practical: 35, reflection: 15 });
  });

  it('teaches datasheet-led I2C, MPU6050 and W25Q64 work without claiming hardware success', async () => {
    const pages = await Promise.all(WEEKS.map((item) => text(`curriculum/weeks/${item.suffix}.md`)));
    expect(pages[0]).toMatch(/开漏|open.?drain/i);
    expect(pages[0]).toMatch(/拉低.*释放|释放.*拉低/s);
    expect(pages[0]).toMatch(/9\s*(?:个|次).*STOP/is);
    expect(pages[0]).toMatch(/NACK/);
    expect(pages[0]).toMatch(/总线卡死|bus.?stuck/i);
    expect(pages[1]).toMatch(/MPU[- ]?6050/i);
    expect(pages[1]).toMatch(/unsigned|无符号/i);
    expect(pages[1]).toMatch(/int16_t/);
    expect(pages[1]).toMatch(/invensense\.tdk\.com/i);
    expect(pages[2]).toMatch(/mode\s*1.*mode\s*2.*mode\s*3/is);
    for (const page of pages.slice(2)) {
      expect(page).toMatch(/mode\s*0|模式\s*0/i);
      expect(page).toMatch(/PB12.*PB13.*PB14.*PB15/s);
      expect(page).toMatch(/EF\s*40\s*17|EF4017/i);
      expect(page).toMatch(/0x007FF000/i);
      expect(page).toMatch(/4\s*KiB/i);
      expect(page).toMatch(/256\s*(?:B|字节)/i);
      expect(page).toMatch(/WEL/);
      expect(page).toMatch(/WIP/);
      expect(page).toMatch(/winbond\.com/i);
      expect(page).toMatch(/恢复.*回读|回读.*恢复/s);
    }
    expect(pages[3]).toMatch(/SPI2/);
    expect(pages[3]).toMatch(/CS.*整个|整个.*CS/s);
    expect(pages[3]).toMatch(/耗时|elapsed/i);
    const allMaterials = `${pages.join('\n')}\n${JSON.stringify(await json('assessments/practicals/gate-05.json'))}`;
    expect(allMaterials).not.toMatch(/(?:已经|已确认|已证明)(?:实机(?:验证|测试|运行)|物理硬件)通过/);
    expect(allMaterials).toMatch(/待实机验证/);
  });
});

describe('phase 5 production firmware behavior', () => {
  it('compiles and executes the production pure C modules on the host', () => {
    const execute = compileAndRunHostBehavior();
    expect(execute.status, `${execute.stdout}\n${execute.stderr}`).toBe(0);
    expect(execute.stdout).toContain('phase-05 host behavior: PASS');
  });

  it('kills a mutation that moves the fixed Flash test sector', () => {
    const execute = compileAndRunHostBehavior(true);
    expect(execute.status).not.toBe(0);
    expect(execute.stderr).toContain('W25Q64_TEST_SECTOR_ADDRESS == 0x007FF000U');
  });

  it('keeps HAL waits bounded and contains no delay, bootloader, mass erase, or web-address ingress', async () => {
    const projectText = `${(await Promise.all(WEEKS.map(async (item) => {
      const root = join(ROOT, 'firmware/lessons', item.project);
      const files = [join(root, 'App/app.c'), join(root, 'App/app.h')];
      return (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
    }))).join('\n')}\n${await text('firmware/shared/w25q64_logic.c')}`;
    expect(projectText).not.toMatch(/HAL_Delay/);
    expect(projectText).not.toMatch(/bootloader|mass\s*erase|0xC7|0x60|web.*address|url.*address/i);
    expect(projectText).toMatch(/HAL_I2C_Mem_(?:Read|Write)\([^;]+,\s*(?:HAL_I2C_TIMEOUT_MS|MPU6050_TIMEOUT_MS)\s*\)/s);
    expect(projectText).toMatch(/HAL_SPI_TransmitReceive\([^;]+,\s*HAL_SPI_TIMEOUT_MS\s*\)/s);
    expect(projectText).toMatch(/W25Q64_TEST_SECTOR_ADDRESS/);
    expect(projectText).toMatch(/W25Q64_PAGE_PROGRAM_TIMEOUT_MS\s*=\s*10U/);
    expect(projectText).toMatch(/W25Q64_SECTOR_ERASE_TIMEOUT_MS\s*=\s*500U/);
    expect(projectText).toMatch(/now_ms[\s\S]*uint32_t\)\(bus->now_ms\(bus->context\)\s*-\s*started\)/);
    expect(projectText).not.toMatch(/MAX_STATUS_POLLS/);

    for (const app of [
      await text('firmware/lessons/w19-software-spi-w25q64/App/app.c'),
      await text('firmware/lessons/w20-hardware-spi-w25q64/App/app.c'),
    ]) {
      expect(app).toMatch(/W25Q64_ReadJedecId[\s\S]*W25Q64_IsExpectedJedecId[\s\S]*W25Q64_RESULT_ID/);
    }

    const i2cApp = await text('firmware/lessons/w17-i2c-compare/App/app.c');
    const i2cLogic = await text('firmware/lessons/w17-i2c-compare/App/i2c_bitbang.c');
    expect(i2cApp).toMatch(/BITBANG_HALF_PERIOD_US\s*=\s*5U/);
    expect(i2cApp).toMatch(/BITBANG_STRETCH_TIMEOUT_MS\s*=\s*10U/);
    expect(i2cApp).toMatch(/DWT->CYCCNT/);
    expect(i2cApp).toMatch(/initial_software_result[\s\S]*recovery_result[\s\S]*software_result/);
    expect(i2cLogic).toMatch(/recovery_result\s*=\s*I2cBitBang_Recover[\s\S]*retried\s*=\s*1U[\s\S]*final_result\s*=\s*I2cBitBang_ReadRegister/s);

    const ci = await text('.github/workflows/ci.yml');
    expect(ci).toMatch(/os:\s*\[ubuntu-latest, windows-latest\]/);
    expect(ci).toMatch(/phase-05-content\.test\.ts/);
  });

  it('configures software/hardware I2C and SPI2 mode 0 on the stated pins', async () => {
    const w17 = await text('firmware/lessons/w17-i2c-compare/w17-i2c-compare.ioc');
    const w18 = await text('firmware/lessons/w18-mpu6050/w18-mpu6050.ioc');
    const w19 = await text('firmware/lessons/w19-software-spi-w25q64/w19-software-spi-w25q64.ioc');
    const w20 = await text('firmware/lessons/w20-hardware-spi-w25q64/w20-hardware-spi-w25q64.ioc');
    expect(w17).toMatch(/I2C1/); expect(w17).toMatch(/PB6/); expect(w17).toMatch(/PB7/);
    expect(w18).toMatch(/I2C1/); expect(w18).toMatch(/PB6/); expect(w18).toMatch(/PB7/);
    expect(w19).toMatch(/PB12/); expect(w19).toMatch(/PB13/); expect(w19).toMatch(/PB14/); expect(w19).toMatch(/PB15/); expect(w19).not.toMatch(/Mcu\.IP\d+=SPI2/);
    expect(w20).toMatch(/Mcu\.IP\d+=SPI2/); expect(w20).toMatch(/SPI2\.Mode=SPI_MODE_MASTER/); expect(w20).toMatch(/SPI2\.VirtualType=VM_MASTER/);
    expect(w20).toMatch(/PB12/); expect(w20).toMatch(/PB13\.Signal=SPI2_SCK/); expect(w20).toMatch(/PB14\.Signal=SPI2_MISO/); expect(w20).toMatch(/PB15\.Signal=SPI2_MOSI/);
  });
});
