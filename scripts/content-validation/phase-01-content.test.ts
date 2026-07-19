import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

const LESSONS = [
  { week: 1, suffix: 'w01', id: 'w01-foundations', labId: 'lab-w01-breadboard', assessmentId: 'assessment-w01' },
  { week: 2, suffix: 'w02', id: 'w02-c-language', labId: 'lab-w02-bitmask', assessmentId: 'assessment-w02' },
  { week: 3, suffix: 'w03', id: 'w03-first-project', labId: 'lab-w03-first-project', assessmentId: 'assessment-w03' },
  { week: 4, suffix: 'w04', id: 'w04-gpio-output', labId: 'lab-w04-gpio-output', assessmentId: 'assessment-w04' },
] as const;

async function readJson(relativePath: string): Promise<any> {
  return JSON.parse(await readFile(join(ROOT, relativePath), 'utf8'));
}

async function expectDirectory(relativePath: string) {
  expect((await stat(join(ROOT, relativePath))).isDirectory()).toBe(true);
}

type SourceRequirement = readonly [label: string, pattern: RegExp];

function missingRequirements(source: string, requirements: readonly SourceRequirement[]) {
  return requirements.filter(([, pattern]) => !pattern.test(source)).map(([label]) => label);
}

const CLOCK_REQUIREMENTS = [
  ['HSE oscillator', /RCC_OscInitStruct\.OscillatorType\s*=\s*RCC_OSCILLATORTYPE_HSE\s*;/],
  ['HSE enabled', /RCC_OscInitStruct\.HSEState\s*=\s*RCC_HSE_ON\s*;/],
  ['PLL source HSE', /RCC_OscInitStruct\.PLL\.PLLSource\s*=\s*RCC_PLLSOURCE_HSE\s*;/],
  ['PLL x9', /RCC_OscInitStruct\.PLL\.PLLMUL\s*=\s*RCC_PLL_MUL9\s*;/],
  ['APB1 divided by two', /RCC_ClkInitStruct\.APB1CLKDivider\s*=\s*RCC_HCLK_DIV2\s*;/],
  ['two flash wait states', /HAL_RCC_ClockConfig\s*\(\s*&RCC_ClkInitStruct\s*,\s*FLASH_LATENCY_2\s*\)/],
] as const satisfies readonly SourceRequirement[];

const APP_TARGET_REQUIREMENTS = [
  ['App source in firmware target', /target_sources\s*\(\s*\$\{CMAKE_PROJECT_NAME\}\s+PRIVATE(?:(?!\)\s*(?:#|\r?\n|$))[\s\S])*?\bApp\/app\.c\b(?:(?!\)\s*(?:#|\r?\n|$))[\s\S])*?\)/],
] as const satisfies readonly SourceRequirement[];

describe('phase 1 checked-in curriculum', () => {
  it('contains the exact four lessons, labs, assessments and first gate', async () => {
    for (const lesson of LESSONS) {
      const manifest = await readJson(`curriculum/weeks/${lesson.suffix}.json`);
      expect(manifest).toMatchObject({
        schemaVersion: 1,
        id: lesson.id,
        week: lesson.week,
        conceptPath: `curriculum/weeks/${lesson.suffix}.md`,
        labIds: [lesson.labId],
        assessmentId: lesson.assessmentId,
      });
      expect((await readFile(join(ROOT, `curriculum/weeks/${lesson.suffix}.md`), 'utf8')).trim()).not.toBe('');

      const lab = await readJson(`labs/manifests/${lesson.labId}.json`);
      expect(lab).toMatchObject({ id: lesson.labId, lessonId: lesson.id });

      const assessment = await readJson(`assessments/question-banks/${lesson.assessmentId}.json`);
      expect(assessment).toMatchObject({ id: lesson.assessmentId, lessonId: lesson.id });
    }

    const gate = await readJson('assessments/practicals/gate-01.json');
    expect(gate).toMatchObject({
      id: 'gate-01',
      phase: 1,
      lessonIds: LESSONS.map((lesson) => lesson.id),
    });
  });

  it('teaches the required concepts, fault exercises, safety and explain-back proofs', async () => {
    const requiredTerms: Record<string, RegExp[]> = {
      w01: [/电势差/, /完整(?:的)?(?:电流)?回路/, /1\s*kΩ/i, /面包板.*电源轨/s, /3\.3\s*V/, /5\s*V/, /二进制/, /十六进制/, /LED.*反接/s, /断电/, /限流/],
      w02: [/有符号/, /无符号/, /位运算/, /掩码/, /函数/, /数组/, /结构体/, /枚举/, /指针/, /地址/, /=.*==/s, /移位/, /逐位/, /值.*地址/s],
      w03: [/Cortex-M3/, /STM32F103/, /时钟树/, /存储器映射/, /CubeMX/, /CMake/, /编译/, /链接/, /ELF/, /烧录/, /调试/, /错误.*(?:调试器|目标)/s, /RCC/, /GPIO/, /生成代码.*边界/s],
      w04: [/推挽/, /开漏/, /输出速度.*边沿/s, /ODR/, /BSRR/, /IDR/, /LED/, /蜂鸣器/, /流水灯|两.*LED/s, /无.*上拉|没有.*上拉/s, /电流路径/, /读.*改.*写|read-modify-write/i],
    };

    for (const lesson of LESSONS) {
      const markdown = await readFile(join(ROOT, `curriculum/weeks/${lesson.suffix}.md`), 'utf8');
      for (const term of requiredTerms[lesson.suffix]) expect(markdown).toMatch(term);
    }

    for (const suffix of ['w03', 'w04']) {
      const markdown = await readFile(join(ROOT, `curriculum/weeks/${suffix}.md`), 'utf8');
      expect(markdown).toMatch(/https:\/\/(?:[^\s/]+\.)?(?:st\.com|dev\.st\.com)\//i);
      expect(markdown).toContain('访问日期：2026-07-19');
    }
  });

  it('distinguishes the lesson bit range from C shift undefined behavior and injects assignment in place of comparison', async () => {
    const lesson = await readFile(join(ROOT, 'curriculum/weeks/w02.md'), 'utf8');
    const lab = await readJson('labs/manifests/lab-w02-bitmask.json');
    const labText = [...lab.expectedObservations, ...lab.faultTasks].join('\n');
    const combined = `${lesson}\n${labText}`;

    expect(combined).toMatch(/1u\s*<<\s*12[\s\S]*32-bit[\s\S]*本身(?:可能)?合法[\s\S]*设计允许范围/);
    expect(combined).toMatch(/移位数[\s\S]*(?:达到|大于等于)[\s\S]*类型宽度[\s\S]*未定义行为/);
    expect(combined).toMatch(/(?:误写|错误地写成|故意写成)[^\n]*`=`[^\n]*(?:正确|原本|应为)[^\n]*`==`/);
    expect(combined).not.toMatch(/`=`\s*误写为\s*`==`/);
    expect(labText).not.toMatch(/编译器[^\n]*(?:预定|设计允许|bit0[^\n]*bit7)[^\n]*(?:警告|检测|抓住)/);
  });

  it('declares honest automatic, device-assisted and manual evidence modes', async () => {
    for (const lesson of LESSONS) {
      const records = [
        await readJson(`curriculum/weeks/${lesson.suffix}.json`),
        await readJson(`labs/manifests/${lesson.labId}.json`),
      ];
      for (const record of records) {
        expect(record.detectionChecks.map((check: any) => check.mode).sort()).toEqual(['automatic', 'manual', 'semi-automatic']);
        for (const check of record.detectionChecks) {
          if (!check.applicable) expect(check.reason.trim()).not.toBe('');
          if (check.evidenceSource === 'simulator') expect(check.physicalHardware).toBe(false);
        }
      }
    }

    for (const relativePath of ['curriculum/weeks/w04.json', 'labs/manifests/lab-w04-gpio-output.json']) {
      const record = await readJson(relativePath);
      expect(record.detectionChecks).toEqual(expect.arrayContaining([
        expect.objectContaining({ mode: 'semi-automatic', applicable: true, evidenceSource: 'device', physicalHardware: true }),
        expect.objectContaining({ mode: 'manual', applicable: true, evidenceSource: 'manual', physicalHardware: true }),
      ]));
    }
  });

  it('uses the exact 25/25/35/15 evidence weights and phase-one gate scope', async () => {
    const expectedTotals = { concept: 25, configuration: 25, practical: 35, reflection: 15 };
    for (const lesson of LESSONS) {
      const assessment = await readJson(`assessments/question-banks/${lesson.assessmentId}.json`);
      const totals = Object.fromEntries(['concept', 'configuration', 'practical', 'reflection'].map((kind) => [
        kind,
        assessment.items.filter((item: any) => item.kind === kind).reduce((sum: number, item: any) => sum + item.maxScore, 0),
      ]));
      expect(totals).toEqual(expectedTotals);
      expect(new Set(assessment.items.flatMap((item: any) => item.tagIds)).size).toBeGreaterThan(0);
    }

    const gate = await readJson('assessments/practicals/gate-01.json');
    const totals = Object.fromEntries(['concept', 'configuration', 'practical', 'reflection'].map((kind) => [
      kind,
      gate.items.filter((item: any) => item.kind === kind).reduce((sum: number, item: any) => sum + item.maxScore, 0),
    ]));
    expect(totals).toEqual(expectedTotals);
    expect(gate.lessonIds).toEqual(LESSONS.map((lesson) => lesson.id));
    expect(JSON.stringify(gate)).toMatch(/新建|全新/);
    expect(JSON.stringify(gate)).toMatch(/LED/);
    expect(JSON.stringify(gate)).toMatch(/CubeMX.*(?:选择|配置|原因)/s);
    expect(JSON.stringify(gate)).toMatch(/修复.*GPIO/s);
    expect(JSON.stringify(gate)).toMatch(/Markdown/);
    expect(JSON.stringify(gate)).toMatch(/提交|commit/i);
  });
});

describe('phase 1 CubeMX firmware projects', () => {
  const projects = ['w03-first-project', 'w04-gpio-output'] as const;

  it('contains complete independent CubeMX, CMake, HAL, Core and App trees', async () => {
    for (const project of projects) {
      const root = `firmware/lessons/${project}`;
      await expectDirectory(root);
      for (const file of [`${project}.ioc`, 'CMakePresets.json', 'CMakeLists.txt']) {
        expect((await stat(join(ROOT, root, file))).isFile()).toBe(true);
      }
      for (const directory of ['Core', 'Drivers', 'cmake', 'App']) await expectDirectory(`${root}/${directory}`);
    }
  });

  it('keeps STM32F103C8Tx, HSE, 72 MHz, Serial Wire and generated HAL boundaries explicit', async () => {
    for (const project of projects) {
      const root = join(ROOT, 'firmware/lessons', project);
      const ioc = await readFile(join(root, `${project}.ioc`), 'utf8');
      const main = await readFile(join(root, 'Core/Src/main.c'), 'utf8');
      expect(ioc).toMatch(/STM32F103C8Tx/);
      expect(ioc).toMatch(/RCC.*HSE|HSE.*Crystal/s);
      expect(ioc).toMatch(/SYS.*Serial_Wire|Serial_Wire.*SYS/s);
      expect(ioc).toMatch(/SYSCLKFreq_VALUE=72000000/);
      expect(missingRequirements(main, CLOCK_REQUIREMENTS)).toEqual([]);
      expect(main).toContain('HAL_Init();');
      expect(main).toContain('SystemClock_Config();');
      expect(main).toContain('MX_GPIO_Init();');
      expect(main).toContain('/* USER CODE BEGIN');
    }
  });

  it('implements lesson behavior only in App code and uses generated main.h aliases', async () => {
    const w03Root = join(ROOT, 'firmware/lessons/w03-first-project');
    const w03 = await readFile(join(ROOT, 'firmware/lessons/w03-first-project/App/app.c'), 'utf8');
    const w03MainHeader = await readFile(join(w03Root, 'Core/Inc/main.h'), 'utf8');
    const w03Gpio = await readFile(join(w03Root, 'Core/Src/gpio.c'), 'utf8');
    const w03Cmake = await readFile(join(w03Root, 'CMakeLists.txt'), 'utf8');
    expect(w03MainHeader).toMatch(/#define\s+LED_Pin\s+GPIO_PIN_13\b/);
    expect(w03MainHeader).toMatch(/#define\s+LED_GPIO_Port\s+GPIOC\b/);
    expect(w03Gpio).toMatch(/HAL_GPIO_WritePin\s*\(\s*LED_GPIO_Port\s*,\s*LED_Pin\s*,\s*GPIO_PIN_SET\s*\)/);
    expect(w03Gpio).toMatch(/GPIO_InitStruct\.Pin\s*=\s*LED_Pin\s*;[\s\S]*?GPIO_InitStruct\.Mode\s*=\s*GPIO_MODE_OUTPUT_PP\s*;[\s\S]*?GPIO_InitStruct\.Pull\s*=\s*GPIO_NOPULL\s*;[\s\S]*?HAL_GPIO_Init\s*\(\s*LED_GPIO_Port\s*,\s*&GPIO_InitStruct\s*\)/);
    expect(missingRequirements(w03Cmake, APP_TARGET_REQUIREMENTS)).toEqual([]);
    expect(w03).toMatch(/App_Init\s*\([^)]*\)[\s\S]*?HAL_GPIO_WritePin\s*\(\s*LED_GPIO_Port\s*,\s*LED_Pin\s*,\s*GPIO_PIN_SET\s*\)/);
    expect(w03).toMatch(/HAL_GPIO_TogglePin\s*\(\s*LED_GPIO_Port\s*,\s*LED_Pin\s*\)/);
    expect(w03).toMatch(/HAL_Delay\s*\(\s*1000U?\s*\)/);

    const w04Root = join(ROOT, 'firmware/lessons/w04-gpio-output');
    const w04 = await readFile(join(ROOT, 'firmware/lessons/w04-gpio-output/App/app.c'), 'utf8');
    const w04Header = await readFile(join(ROOT, 'firmware/lessons/w04-gpio-output/App/app.h'), 'utf8');
    const w04MainHeader = await readFile(join(w04Root, 'Core/Inc/main.h'), 'utf8');
    const w04Gpio = await readFile(join(w04Root, 'Core/Src/gpio.c'), 'utf8');
    const w04Cmake = await readFile(join(w04Root, 'CMakeLists.txt'), 'utf8');
    expect(w04Header).toMatch(/void\s+App_SetLed\s*\(\s*bool\s+on\s*\)/);
    expect(w04Header).toMatch(/void\s+App_ToggleLed\s*\(\s*void\s*\)/);
    expect(w04Header).toMatch(/void\s+App_SetBuzzer\s*\(\s*bool\s+on\s*\)/);
    expect(w04MainHeader).toMatch(/#define\s+LED_Pin\s+GPIO_PIN_13\b/);
    expect(w04MainHeader).toMatch(/#define\s+LED_GPIO_Port\s+GPIOC\b/);
    expect(w04MainHeader).toMatch(/#define\s+LED2_Pin\s+GPIO_PIN_0\b/);
    expect(w04MainHeader).toMatch(/#define\s+LED2_GPIO_Port\s+GPIOB\b/);
    expect(w04MainHeader).toMatch(/#define\s+BUZZER_Pin\s+GPIO_PIN_1\b/);
    expect(w04MainHeader).toMatch(/#define\s+BUZZER_GPIO_Port\s+GPIOB\b/);
    expect(w04Gpio).toMatch(/HAL_GPIO_WritePin\s*\(\s*LED_GPIO_Port\s*,\s*LED_Pin\s*,\s*GPIO_PIN_SET\s*\)/);
    expect(w04Gpio).toMatch(/HAL_GPIO_WritePin\s*\(\s*GPIOB\s*,\s*LED2_Pin\s*\|\s*BUZZER_Pin\s*,\s*GPIO_PIN_RESET\s*\)/);
    expect(w04Gpio).toMatch(/GPIO_InitStruct\.Pin\s*=\s*LED_Pin\s*;[\s\S]*?GPIO_InitStruct\.Mode\s*=\s*GPIO_MODE_OUTPUT_PP\s*;[\s\S]*?GPIO_InitStruct\.Pull\s*=\s*GPIO_NOPULL\s*;[\s\S]*?HAL_GPIO_Init\s*\(\s*LED_GPIO_Port\s*,\s*&GPIO_InitStruct\s*\)/);
    expect(w04Gpio).toMatch(/GPIO_InitStruct\.Pin\s*=\s*LED2_Pin\s*\|\s*BUZZER_Pin\s*;[\s\S]*?GPIO_InitStruct\.Mode\s*=\s*GPIO_MODE_OUTPUT_PP\s*;[\s\S]*?GPIO_InitStruct\.Pull\s*=\s*GPIO_NOPULL\s*;[\s\S]*?HAL_GPIO_Init\s*\(\s*GPIOB\s*,\s*&GPIO_InitStruct\s*\)/);
    expect(missingRequirements(w04Cmake, APP_TARGET_REQUIREMENTS)).toEqual([]);
    expect(w04).toMatch(/LED_ACTIVE_STATE\s*=\s*GPIO_PIN_RESET\s*;/);
    expect(w04).toMatch(/LED_INACTIVE_STATE\s*=\s*GPIO_PIN_SET\s*;/);
    expect(w04).toMatch(/LED2_ACTIVE_STATE\s*=\s*GPIO_PIN_SET\s*;/);
    expect(w04).toMatch(/LED2_INACTIVE_STATE\s*=\s*GPIO_PIN_RESET\s*;/);
    expect(w04).toMatch(/BUZZER_ACTIVE_STATE\s*=\s*GPIO_PIN_SET\s*;/);
    expect(w04).toMatch(/BUZZER_INACTIVE_STATE\s*=\s*GPIO_PIN_RESET\s*;/);
    expect(w04).toMatch(/void\s+App_SetLed\s*\(\s*bool\s+on\s*\)[\s\S]*?PinStateFor\s*\(\s*on\s*,\s*LED_ACTIVE_STATE\s*,\s*LED_INACTIVE_STATE\s*\)/);
    expect(w04).toMatch(/void\s+App_SetSecondLed\s*\(\s*bool\s+on\s*\)[\s\S]*?PinStateFor\s*\(\s*on\s*,\s*LED2_ACTIVE_STATE\s*,\s*LED2_INACTIVE_STATE\s*\)/);
    expect(w04).toMatch(/void\s+App_SetBuzzer\s*\(\s*bool\s+on\s*\)[\s\S]*?PinStateFor\s*\(\s*on\s*,\s*BUZZER_ACTIVE_STATE\s*,\s*BUZZER_INACTIVE_STATE\s*\)/);
    expect(w04).toMatch(/LED_GPIO_Port/);
    expect(w04).toMatch(/LED_Pin/);
    expect(w04).toMatch(/BUZZER_GPIO_Port/);
    expect(w04).toMatch(/BUZZER_Pin/);
    expect(w04).toMatch(/App_SetSecondLed\s*\(\s*!sequence_on\s*\)/);
    expect(w04).toMatch(/App_SetBuzzer\s*\(\s*!sequence_on\s*\)/);
    expect(w04).not.toMatch(/GPIO_PIN_\d+/);
  });

  it('rejects critical clock, pin, polarity, safe-level and build-target mutations', async () => {
    const w03Root = join(ROOT, 'firmware/lessons/w03-first-project');
    const w04Root = join(ROOT, 'firmware/lessons/w04-gpio-output');
    const w03Main = await readFile(join(w03Root, 'Core/Src/main.c'), 'utf8');
    const w04Header = await readFile(join(w04Root, 'Core/Inc/main.h'), 'utf8');
    const w04Gpio = await readFile(join(w04Root, 'Core/Src/gpio.c'), 'utf8');
    const w04App = await readFile(join(w04Root, 'App/app.c'), 'utf8');
    const w04Cmake = await readFile(join(w04Root, 'CMakeLists.txt'), 'utf8');

    expect(missingRequirements(w03Main.replace('RCC_PLL_MUL9', 'RCC_PLL_MUL8'), CLOCK_REQUIREMENTS)).toContain('PLL x9');
    expect(w04Header.replace('BUZZER_Pin GPIO_PIN_1', 'BUZZER_Pin GPIO_PIN_2')).not.toMatch(/#define\s+BUZZER_Pin\s+GPIO_PIN_1\b/);
    expect(w04Gpio.replace('LED_GPIO_Port, LED_Pin, GPIO_PIN_SET', 'LED_GPIO_Port, LED_Pin, GPIO_PIN_RESET')).not.toMatch(/HAL_GPIO_WritePin\s*\(\s*LED_GPIO_Port\s*,\s*LED_Pin\s*,\s*GPIO_PIN_SET\s*\)/);
    expect(w04App.replace('LED_ACTIVE_STATE = GPIO_PIN_RESET', 'LED_ACTIVE_STATE = GPIO_PIN_SET')).not.toMatch(/LED_ACTIVE_STATE\s*=\s*GPIO_PIN_RESET\s*;/);
    expect(missingRequirements(w04Cmake.replace('App/app.c', 'App/missing.c'), APP_TARGET_REQUIREMENTS)).toContain('App source in firmware target');
  });
});
