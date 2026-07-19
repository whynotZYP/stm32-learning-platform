import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseWeekSelection, validateRepositoryContent } from './validate-content';

const SOURCE_IDS = ['05', '06-1', '06-2', ...Array.from({ length: 43 }, (_, index) => String(index + 7).padStart(2, '0'))];
const REQUIRED_TAG_IDS = [
  'gpio.output-mode', 'exti.event-flow', 'nvic.priority', 'tim.timebase',
  'adc.sampling', 'dma.transfer', 'usart.physical-frame', 'i2c.protocol',
  'spi.protocol', 'rtc.time', 'pwr.low-power', 'wdg.recovery', 'flash.persistence',
];
const TAG_PREREQUISITES: Record<string, string[]> = {
  'foundation.electricity': [],
  'foundation.binary': [],
  'c.control-flow': ['foundation.binary'],
  'c.memory': ['c.control-flow'],
  'mcu.memory-map': ['c.memory'],
  'toolchain.build-debug': ['c.control-flow'],
  'gpio.output-mode': ['foundation.electricity', 'mcu.memory-map'],
  'gpio.input-bias': ['foundation.electricity', 'gpio.output-mode'],
  'debug.observation': ['toolchain.build-debug'],
  'nvic.priority': ['mcu.memory-map'],
  'exti.event-flow': ['gpio.input-bias', 'nvic.priority'],
  'tim.timebase': ['foundation.binary', 'nvic.priority'],
  'tim.pwm': ['tim.timebase', 'gpio.output-mode'],
  'tim.capture': ['tim.timebase', 'gpio.input-bias'],
  'tim.encoder': ['tim.capture'],
  'adc.sampling': ['foundation.electricity', 'tim.timebase'],
  'dma.transfer': ['c.memory', 'mcu.memory-map'],
  'usart.physical-frame': ['foundation.binary', 'gpio.output-mode'],
  'usart.packet': ['usart.physical-frame', 'exti.event-flow'],
  'i2c.protocol': ['gpio.output-mode', 'usart.packet'],
  'i2c.mpu6050': ['i2c.protocol', 'debug.observation'],
  'spi.protocol': ['foundation.binary', 'gpio.output-mode'],
  'spi.w25q64': ['spi.protocol', 'c.memory'],
  'rtc.time': ['tim.timebase', 'c.memory'],
  'pwr.low-power': ['rtc.time', 'exti.event-flow'],
  'wdg.recovery': ['tim.timebase', 'debug.observation'],
  'flash.persistence': ['c.memory', 'mcu.memory-map'],
  'system.integration': ['gpio.output-mode', 'exti.event-flow', 'tim.pwm', 'tim.capture', 'adc.sampling', 'dma.transfer', 'usart.packet', 'i2c.mpu6050', 'spi.w25q64', 'rtc.time', 'pwr.low-power', 'wdg.recovery', 'flash.persistence'],
};
const HARDWARE_CHECKS = [
  { mode: 'automatic', action: '运行自动日志验证流程', expectedEvidence: '自动测试日志记录', limitation: '自动检查不能证明全部物理现象', applicable: true, evidenceSource: 'device', physicalHardware: true },
  { mode: 'semi-automatic', action: '连接设备并确认返回数值', expectedEvidence: '设备返回数值记录', limitation: '仍需学习者确认接线条件', applicable: true, evidenceSource: 'device', physicalHardware: true },
  { mode: 'manual', action: '手动观察并记录真实现象', expectedEvidence: '人工观察结果记录', limitation: '人工观察不能由构建替代', applicable: true, evidenceSource: 'manual', physicalHardware: true },
];
const HEADINGS = ['学完后能解释', '学完后能做到', '概念模型', 'CubeMX 为什么这样配', '最小实验', '调试与寄存器观察', '故障注入', '复述检查', '学习笔记'];
const expectedFailures = [
  '必须恰好有 24 个周清单和 24 个周正文',
  '知识标签存在循环前置关系',
  '周正文缺少章节：故障注入',
  '实验缺少断电接线安全项',
  '考核未覆盖四类证据',
  '核心主题缺少实验',
  '源课程未被周清单引用',
  '固件路径不存在',
] as const;

let fixtureTemplate = '';
const fixtureRoots: string[] = [];

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readJson(path: string): Promise<any> {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function createCompleteFixture(root: string) {
  for (const directory of ['curriculum/weeks', 'labs/manifests', 'assessments/question-banks', 'assessments/practicals', 'firmware/lessons']) {
    await mkdir(join(root, directory), { recursive: true });
  }

  const weeks = Array.from({ length: 24 }, (_, index) => {
    const week = index + 1;
    const sourceCourseIds = index === 0 ? SOURCE_IDS : [];
    return { schemaVersion: 1, week, title: `第 ${week} 周课程`, phase: Math.ceil(week / 4), sourceCourseIds, lessonIds: [`w${String(week).padStart(2, '0')}-lesson`], gateAfter: week % 4 === 0 };
  });
  await writeJson(join(root, 'curriculum/course-map.json'), { schemaVersion: 1, sourceCourseIds: SOURCE_IDS, requiredTagIds: REQUIRED_TAG_IDS, weeks });
  await writeJson(join(root, 'curriculum/source-api-inventory.json'), {
    schemaVersion: 1,
    records: SOURCE_IDS.map((sourceCourseId) => ({ sourceCourseId, sourceTitle: `可核验源课程 ${sourceCourseId}`, sourceUrl: 'https://example.com/stm32-course', accessedAt: '2026-07-19', splSymbols: [] })),
  });
  await writeJson(join(root, 'curriculum/knowledge-tags.json'), {
    schemaVersion: 1,
    tags: Object.entries(TAG_PREREQUISITES).map(([id, prerequisiteTagIds]) => ({ schemaVersion: 1, id, title: `标签 ${id}`, plainLanguage: `这是关于 ${id} 的通俗中文解释，帮助学习者理解概念。`, prerequisiteTagIds })),
  });

  for (const week of weeks) {
    const suffix = String(week.week).padStart(2, '0');
    const lessonId = week.lessonIds[0];
    const labId = `lab-w${suffix}`;
    const assessmentId = `assessment-w${suffix}`;
    await writeJson(join(root, `curriculum/weeks/w${suffix}.json`), {
      schemaVersion: 1, id: lessonId, week: week.week, title: `第 ${week.week} 周正文`, estimatedMinutes: 60,
      sourceCourseIds: week.sourceCourseIds, prerequisiteTagIds: [], targetTagIds: REQUIRED_TAG_IDS,
      objectives: ['能够解释本周概念并完成验证实验'], conceptPath: `curriculum/weeks/w${suffix}.md`, labIds: [labId], assessmentId,
      safety: ['所有接线都必须先断电并复核。'], detectionChecks: HARDWARE_CHECKS,
    });
    await writeFile(join(root, `curriculum/weeks/w${suffix}.md`), `${HEADINGS.map((heading) => `## ${heading}\n\n本节提供足够详细的学习说明。`).join('\n\n')}\n\n## 资料来源\n\nhttps://www.st.com/resource\n\n访问日期：2026-07-19\n`, 'utf8');
    await writeJson(join(root, `labs/manifests/${labId}.json`), {
      schemaVersion: 1, id: labId, lessonId, title: `第 ${week.week} 周实验`, hardware: ['STM32 开发板'],
      wiringChecklist: ['断电后连接开发板并逐项复核接线。'], safety: ['断电接线并使用 3.3 V 逻辑。'], expectedObservations: ['观察到预期设备结果'],
      faultTasks: ['断开一路信号后定位并修复故障。'], detectionChecks: HARDWARE_CHECKS, firmwareProject: `firmware/lessons/w${suffix}`,
    });
    await mkdir(join(root, `firmware/lessons/w${suffix}`), { recursive: true });
    await writeJson(join(root, `assessments/question-banks/${assessmentId}.json`), {
      schemaVersion: 1, id: assessmentId, lessonId,
      items: [
        { id: `q${suffix}-concept`, kind: 'concept', prompt: '解释本周核心概念以及信号路径。', tagIds: REQUIRED_TAG_IDS, maxScore: 25, rubric: ['解释准确且完整'] },
        { id: `q${suffix}-configuration`, kind: 'configuration', prompt: '说明配置和代码选择背后的原因。', tagIds: REQUIRED_TAG_IDS, maxScore: 25, rubric: ['配置理由准确完整'] },
        { id: `q${suffix}-practical`, kind: 'practical', prompt: '完成实验并定位一个注入的故障。', tagIds: REQUIRED_TAG_IDS, maxScore: 35, rubric: ['证据完整且能复现'] },
        { id: `q${suffix}-reflection`, kind: 'reflection', prompt: '复述本周收获并整理学习笔记。', tagIds: REQUIRED_TAG_IDS, maxScore: 15, rubric: ['反思具体且可行动'] },
      ],
    });
    if (week.gateAfter) {
      await writeJson(join(root, `assessments/practicals/gate-${String(week.phase).padStart(2, '0')}.json`), {
        schemaVersion: 1, id: `gate-${String(week.phase).padStart(2, '0')}`, phase: week.phase, title: `阶段 ${week.phase} 实践考核`,
        lessonIds: weeks.slice((week.phase - 1) * 4, week.phase * 4).map((item) => item.lessonIds[0]), requiredTagIds: REQUIRED_TAG_IDS,
        items: [{ id: `gate-${week.phase}-practical`, kind: 'practical', prompt: '完成阶段综合实践并提交可复现证据。', tagIds: REQUIRED_TAG_IDS, maxScore: 100, rubric: ['证据完整'] }],
      });
    }
  }
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'stm32-content-case-'));
  fixtureRoots.push(root);
  await cp(fixtureTemplate, root, { recursive: true });
  return root;
}

async function validate(root: string, weeks?: number[]) {
  return validateRepositoryContent(root, { weeks, requireCompleteRepository: weeks === undefined });
}

beforeAll(async () => {
  fixtureTemplate = await mkdtemp(join(tmpdir(), 'stm32-content-template-'));
  await createCompleteFixture(fixtureTemplate);
});

afterAll(async () => {
  await Promise.all([...fixtureRoots, fixtureTemplate].filter(Boolean).map((root) => rm(root, { recursive: true, force: true })));
});

describe('validateRepositoryContent', () => {
  it('ships the checked-in 46-source inventory and exact 28-tag graph', async () => {
    const inventory = await readJson(join(process.cwd(), 'curriculum/source-api-inventory.json'));
    expect(inventory.schemaVersion).toBe(1);
    expect(inventory.records.map((record: any) => record.sourceCourseId).sort()).toEqual([...SOURCE_IDS].sort());
    for (const record of inventory.records) {
      expect(record.sourceTitle).toMatch(/^【STM32】/);
      expect(record.sourceUrl).toMatch(/^https:\/\//);
      expect(record.accessedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Array.isArray(record.splSymbols)).toBe(true);
    }
    const tags = await readJson(join(process.cwd(), 'curriculum/knowledge-tags.json'));
    expect(Object.fromEntries(tags.tags.map((tag: any) => [tag.id, tag.prerequisiteTagIds]))).toEqual(TAG_PREREQUISITES);
  });

  it('accepts the fixture-generated complete repository used until Tasks 2-8 populate checked-in content', async () => {
    const report = await validate(await fixture());
    expect(report).toEqual({ ok: true, errors: [] });
  });

  it('requires exactly 24 manifest and Markdown pairs in complete mode', async () => {
    const root = await fixture();
    await rm(join(root, 'curriculum/weeks/w24.md'));
    expect((await validate(root)).errors).toContain(expectedFailures[0]);
  });

  it('detects a cycle in the knowledge-tag prerequisites', async () => {
    const root = await fixture();
    const path = join(root, 'curriculum/knowledge-tags.json');
    const inventory = await readJson(path);
    inventory.tags.find((tag: any) => tag.id === 'foundation.electricity').prerequisiteTagIds = ['system.integration'];
    await writeJson(path, inventory);
    expect((await validate(root)).errors).toContain(expectedFailures[1]);
  });

  it('rejects a wrong prerequisite edge even when the graph stays acyclic', async () => {
    const root = await fixture();
    const path = join(root, 'curriculum/knowledge-tags.json');
    const inventory = await readJson(path);
    inventory.tags.find((tag: any) => tag.id === 'foundation.electricity').prerequisiteTagIds = ['foundation.binary'];
    await writeJson(path, inventory);
    expect((await validate(root)).errors).toContain('知识标签前置关系不符合课程合同：foundation.electricity');
  });

  it('requires the fault-injection Markdown heading', async () => {
    const root = await fixture();
    const path = join(root, 'curriculum/weeks/w01.md');
    await writeFile(path, (await readFile(path, 'utf8')).replace('## 故障注入', '## 常见问题'), 'utf8');
    expect((await validate(root)).errors).toContain(expectedFailures[2]);
  });

  it('requires power-off wiring safety in every lab', async () => {
    const root = await fixture();
    const path = join(root, 'labs/manifests/lab-w01.json');
    const lab = await readJson(path);
    lab.wiringChecklist = ['连接开发板并逐项复核接线。'];
    lab.safety = ['使用 3.3 V 逻辑电平。'];
    await writeJson(path, lab);
    expect((await validate(root)).errors).toContain(expectedFailures[3]);
  });

  it('does not treat unrelated power-off wording as a lab safety line', async () => {
    const root = await fixture();
    const path = join(root, 'labs/manifests/lab-w01.json');
    const lab = await readJson(path);
    lab.title = '断电现象观察实验';
    lab.wiringChecklist = ['连接开发板并逐项复核接线。'];
    lab.safety = ['只使用 3.3 V 逻辑电平。'];
    await writeJson(path, lab);
    expect((await validate(root)).errors).toContain(expectedFailures[3]);
  });

  it('requires independent power and common ground for motor or servo labs', async () => {
    const root = await fixture();
    const path = join(root, 'labs/manifests/lab-w01.json');
    const lab = await readJson(path);
    lab.title = '舵机与直流电机实验';
    await writeJson(path, lab);
    const errors = (await validate(root)).errors;
    expect(errors).toContain('电机或舵机实验必须说明独立供电和共地');
  });

  it('requires all four assessment evidence kinds with exact category totals', async () => {
    const root = await fixture();
    const path = join(root, 'assessments/question-banks/assessment-w01.json');
    const assessment = await readJson(path);
    assessment.items = assessment.items.filter((item: any) => item.kind !== 'reflection');
    await writeJson(path, assessment);
    expect((await validate(root)).errors).toContain(expectedFailures[4]);
  });

  it('rejects incorrect 25/25/35/15 category totals even when all kinds exist', async () => {
    const root = await fixture();
    const path = join(root, 'assessments/question-banks/assessment-w01.json');
    const assessment = await readJson(path);
    assessment.items[0].maxScore = 24;
    await writeJson(path, assessment);
    expect((await validate(root)).errors).toContain(expectedFailures[4]);
  });

  it('requires every core topic to reference a lab', async () => {
    const root = await fixture();
    for (let week = 1; week <= 24; week += 1) {
      const path = join(root, `curriculum/weeks/w${String(week).padStart(2, '0')}.json`);
      const lesson = await readJson(path);
      lesson.labIds = [];
      await writeJson(path, lesson);
    }
    expect((await validate(root)).errors).toContain(expectedFailures[5]);
  });

  it('requires every source course to be referenced by a week manifest', async () => {
    const root = await fixture();
    const courseMapPath = join(root, 'curriculum/course-map.json');
    const courseMap = await readJson(courseMapPath);
    courseMap.weeks[0].sourceCourseIds = courseMap.weeks[0].sourceCourseIds.filter((id: string) => id !== '49');
    await writeJson(courseMapPath, courseMap);
    const lessonPath = join(root, 'curriculum/weeks/w01.json');
    const lesson = await readJson(lessonPath);
    lesson.sourceCourseIds = lesson.sourceCourseIds.filter((id: string) => id !== '49');
    await writeJson(lessonPath, lesson);
    expect((await validate(root)).errors).toContain(expectedFailures[6]);
  });

  it('requires every referenced firmware path to exist', async () => {
    const root = await fixture();
    await rm(join(root, 'firmware/lessons/w01'), { recursive: true });
    expect((await validate(root)).errors).toContain(expectedFailures[7]);
  });

  it('requires firmware project references to point to directories', async () => {
    const root = await fixture();
    const path = join(root, 'firmware/lessons/w01');
    await rm(path, { recursive: true });
    await writeFile(path, 'not a project directory', 'utf8');
    expect((await validate(root)).errors).toContain(expectedFailures[7]);
  });

  it('rejects a course-map lesson ID without a matching weekly manifest', async () => {
    const root = await fixture();
    const path = join(root, 'curriculum/course-map.json');
    const courseMap = await readJson(path);
    courseMap.weeks[0].lessonIds.push('w01-unresolved');
    await writeJson(path, courseMap);
    expect((await validate(root)).errors).toContain('课程地图引用的课程清单不存在：w01-unresolved');
  });

  it.each([
    ['missing', (records: any[]) => records.slice(1)],
    ['duplicate', (records: any[]) => [...records.slice(1), records[1]]],
  ])('rejects a %s source inventory ID', async (_name, mutate) => {
    const root = await fixture();
    const path = join(root, 'curriculum/source-api-inventory.json');
    const inventory = await readJson(path);
    inventory.records = mutate(inventory.records);
    await writeJson(path, inventory);
    expect((await validate(root)).errors).toContain('源 API 清单必须恰好包含 46 个唯一课程 ID');
  });

  it('requires source inventory provenance', async () => {
    const root = await fixture();
    const path = join(root, 'curriculum/source-api-inventory.json');
    const inventory = await readJson(path);
    inventory.records[0].sourceUrl = '';
    await writeJson(path, inventory);
    expect((await validate(root)).errors).toContain('源 API 清单缺少完整来源信息：05');
  });

  it('requires an explicit splSymbols array', async () => {
    const root = await fixture();
    const path = join(root, 'curriculum/source-api-inventory.json');
    const inventory = await readJson(path);
    delete inventory.records[0].splSymbols;
    await writeJson(path, inventory);
    expect((await validate(root)).errors).toContain('源 API 清单缺少 splSymbols：05');
  });

  it('requires all three detection modes on lessons and labs', async () => {
    const root = await fixture();
    const path = join(root, 'curriculum/weeks/w01.json');
    const lesson = await readJson(path);
    lesson.detectionChecks = lesson.detectionChecks.slice(0, 2);
    await writeJson(path, lesson);
    expect((await validate(root)).errors).toContain('课程或实验必须声明三种检测模式');
  });

  it('requires a reason for each non-applicable detection check', async () => {
    const root = await fixture();
    const path = join(root, 'labs/manifests/lab-w01.json');
    const lab = await readJson(path);
    lab.detectionChecks[0].applicable = false;
    await writeJson(path, lab);
    expect((await validate(root)).errors).toContain('不适用检测必须说明原因');
  });

  it.each(['remediationPaths', 'extensionPaths'])('requires every referenced %s entry to exist', async (field) => {
    const root = await fixture();
    const path = join(root, 'curriculum/weeks/w01.json');
    const lesson = await readJson(path);
    lesson[field] = [`curriculum/missing-${field}.md`];
    await writeJson(path, lesson);
    expect((await validate(root)).errors).toContain(`课程引用路径不存在：curriculum/missing-${field}.md`);
  });

  it('requires device and manual physical checks for every core hardware tag', async () => {
    const root = await fixture();
    for (let week = 1; week <= 24; week += 1) {
      for (const relative of [`curriculum/weeks/w${String(week).padStart(2, '0')}.json`, `labs/manifests/lab-w${String(week).padStart(2, '0')}.json`]) {
        const path = join(root, relative);
        const record = await readJson(path);
        record.detectionChecks = record.detectionChecks.map((check: any) => check.mode === 'semi-automatic' ? { ...check, evidenceSource: 'simulator', physicalHardware: false } : check);
        await writeJson(path, record);
      }
    }
    expect((await validate(root)).errors).toContain('核心硬件主题缺少设备半自动物理证据：gpio.output-mode');
  });

  it('requires a manual physical-hardware path independently of the device path', async () => {
    const root = await fixture();
    for (let week = 1; week <= 24; week += 1) {
      for (const relative of [`curriculum/weeks/w${String(week).padStart(2, '0')}.json`, `labs/manifests/lab-w${String(week).padStart(2, '0')}.json`]) {
        const path = join(root, relative);
        const record = await readJson(path);
        record.detectionChecks = record.detectionChecks.map((check: any) => check.mode === 'manual' ? { ...check, applicable: false, physicalHardware: false, reason: '故意构造缺失人工物理证据' } : check);
        await writeJson(path, record);
      }
    }
    expect((await validate(root)).errors).toContain('核心硬件主题缺少人工物理证据：gpio.output-mode');
  });

  it('rejects simulator evidence that claims physical hardware', async () => {
    const root = await fixture();
    const path = join(root, 'curriculum/weeks/w01.json');
    const lesson = await readJson(path);
    lesson.detectionChecks[0].evidenceSource = 'simulator';
    lesson.detectionChecks[0].physicalHardware = true;
    await writeJson(path, lesson);
    expect((await validate(root)).errors).toContain('模拟器检测不能声明物理硬件证据');
  });

  it('requires all Markdown headings, a dated HTTPS source, and an ST primary source for weeks 3-22', async () => {
    const root = await fixture();
    const path = join(root, 'curriculum/weeks/w03.md');
    await writeFile(path, (await readFile(path, 'utf8')).replace('https://www.st.com/resource', 'https://example.com/resource').replace('访问日期：2026-07-19', '访问日期未知'), 'utf8');
    const errors = (await validate(root)).errors;
    expect(errors).toContain('资料来源缺少 HTTPS 链接或访问日期：w03');
    expect(errors).toContain('外设周缺少 ST 官方一手资料：w03');
  });

  it('validates only the requested week set in scoped mode', async () => {
    const root = await fixture();
    await rm(join(root, 'curriculum/weeks/w24.md'));
    expect(await validate(root, [1, 2, 3, 4])).toEqual({ ok: true, errors: [] });
  });

  it('does not require future hardware tags during a scoped validation', async () => {
    const root = await fixture();
    for (let week = 1; week <= 4; week += 1) {
      const path = join(root, `curriculum/weeks/w${String(week).padStart(2, '0')}.json`);
      const lesson = await readJson(path);
      lesson.targetTagIds = ['gpio.output-mode'];
      await writeJson(path, lesson);
    }
    expect(await validate(root, [1, 2, 3, 4])).toEqual({ ok: true, errors: [] });
  });
});

describe('parseWeekSelection', () => {
  it('expands an inclusive CLI range', () => {
    expect(parseWeekSelection(['--weeks', '5-8'])).toEqual([5, 6, 7, 8]);
  });

  it('rejects malformed or out-of-bounds CLI ranges', () => {
    expect(() => parseWeekSelection(['--weeks', '5'])).toThrow('--weeks 必须使用起止范围');
    expect(() => parseWeekSelection(['--weeks', '0-25'])).toThrow('--weeks 必须位于 1–24');
  });
});
