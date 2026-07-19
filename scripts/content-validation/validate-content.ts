import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';
import {
  AssessmentSchema,
  CORE_HARDWARE_TAG_IDS,
  CourseMapSchema,
  KnowledgeTagSchema,
  LabManifestSchema,
  LessonManifestSchema,
  PracticalGateSchema,
  RepositoryPathSchema,
} from '../../web/src/domain/content/schemas';

export interface ValidationReport {
  ok: boolean;
  errors: string[];
}

export interface RepositoryValidationOptions {
  weeks?: number[];
  requireCompleteRepository: boolean;
}

const EXPECTED_SOURCE_IDS = [
  '05',
  '06-1',
  '06-2',
  ...Array.from({ length: 43 }, (_, index) => String(index + 7).padStart(2, '0')),
];

const REQUIRED_TOPICS = [
  'gpio.output-mode',
  'exti.event-flow',
  'nvic.priority',
  'tim.timebase',
  'adc.sampling',
  'dma.transfer',
  'usart.physical-frame',
  'i2c.protocol',
  'spi.protocol',
  'rtc.time',
  'pwr.low-power',
  'wdg.recovery',
  'flash.persistence',
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

const REQUIRED_HEADINGS = [
  '学完后能解释',
  '学完后能做到',
  '概念模型',
  'CubeMX 为什么这样配',
  '最小实验',
  '调试与寄存器观察',
  '故障注入',
  '复述检查',
  '学习笔记',
  '资料来源',
];

interface ReadableCourseMap {
  sourceCourseIds?: string[];
  requiredTagIds?: string[];
  weekNumbers?: number[];
  mappedSourceIds?: string[];
}

interface DetectionCheck {
  mode?: unknown;
  applicable?: unknown;
  reason?: unknown;
  evidenceSource?: unknown;
  physicalHardware?: unknown;
}

interface CoreCoverage {
  lesson: boolean;
  lab: boolean;
  fault: boolean;
  assessment: boolean;
}

function asRecord(value: unknown): Record<string, any> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, any>
    : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : undefined;
}

function readCourseMap(input: unknown): ReadableCourseMap {
  const map = asRecord(input);
  if (!map) return {};

  const weeks = Array.isArray(map.weeks) ? map.weeks.map(asRecord) : undefined;
  const weekNumbers = weeks?.every((week) => typeof week?.week === 'number')
    ? weeks.map((week) => week!.week as number)
    : undefined;
  const sourceLists = weeks?.map((week) => readStringArray(week?.sourceCourseIds));
  const mappedSourceIds = sourceLists?.every((sources) => sources !== undefined)
    ? sourceLists.flat()
    : undefined;

  return {
    sourceCourseIds: readStringArray(map.sourceCourseIds),
    requiredTagIds: readStringArray(map.requiredTagIds),
    weekNumbers,
    mappedSourceIds,
  };
}

function sameSetWithMultiplicity(actual: string[], expected: string[]): boolean {
  return [...actual].sort().join(',') === [...expected].sort().join(',');
}

export function validateCourseMap(input: unknown): ValidationReport {
  const parsed = CourseMapSchema.safeParse(input);
  const errors = parsed.success
    ? []
    : [
      '课程地图结构无效',
      ...parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    ];
  const data = readCourseMap(parsed.success ? parsed.data : input);
  const expectedWeeks = Array.from({ length: 24 }, (_, index) => index + 1);

  if (data.weekNumbers !== undefined && !sameSetWithMultiplicity(data.weekNumbers.map(String), expectedWeeks.map(String))) {
    errors.push('周编号必须恰好覆盖 1–24，不能重复');
  }

  if (data.sourceCourseIds !== undefined && !sameSetWithMultiplicity(data.sourceCourseIds, EXPECTED_SOURCE_IDS)) {
    errors.push('源课程必须完整覆盖 05–49，并包含 06-1/06-2，共 46 份');
  }

  if (data.mappedSourceIds !== undefined) {
    const mappedSources = new Set(data.mappedSourceIds);
    const unknownMapped = [...new Set(data.mappedSourceIds.filter((id) => !EXPECTED_SOURCE_IDS.includes(id)))].sort();
    if (unknownMapped.length) errors.push(`周映射包含未知源课程：${unknownMapped.join(', ')}`);
    const unmapped = EXPECTED_SOURCE_IDS.filter((id) => !mappedSources.has(id));
    if (unmapped.length) errors.push(`未映射源课程：${unmapped.join(', ')}`);
  }

  if (data.requiredTagIds !== undefined && !sameSetWithMultiplicity(data.requiredTagIds, REQUIRED_TOPICS)) {
    errors.push('核心主题必须与规定主题精确相等，不能缺少、额外或重复');
  }

  return { ok: errors.length === 0, errors };
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function readJson(path: string, errors: string[], label: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    errors.push(`${label}不存在或不是有效 JSON`);
    return undefined;
  }
}

function addOnce(errors: string[], error: string) {
  if (!errors.includes(error)) errors.push(error);
}

function validateDetectionChecks(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    addOnce(errors, '课程或实验必须声明三种检测模式');
    return;
  }
  const checks = value.map((item) => asRecord(item) as DetectionCheck | undefined);
  const modes = checks.map((check) => check?.mode);
  if (checks.length !== 3 || new Set(modes).size !== 3 || !['automatic', 'semi-automatic', 'manual'].every((mode) => modes.includes(mode))) {
    addOnce(errors, '课程或实验必须声明三种检测模式');
  }
  for (const check of checks) {
    if (check?.applicable === false && (typeof check.reason !== 'string' || !check.reason.trim())) addOnce(errors, '不适用检测必须说明原因');
    if (check?.evidenceSource === 'simulator' && check.physicalHardware === true) addOnce(errors, '模拟器检测不能声明物理硬件证据');
  }
}

function validateTagGraph(value: unknown, errors: string[]): Set<string> {
  const root = asRecord(value);
  const tags = Array.isArray(root?.tags) ? root.tags : [];
  const parsedTags = tags.map((tag) => KnowledgeTagSchema.safeParse(tag));
  if (root?.schemaVersion !== 1 || parsedTags.some((tag) => !tag.success)) addOnce(errors, '知识标签清单结构无效');

  const records = tags.map(asRecord).filter((tag): tag is Record<string, any> => tag !== undefined);
  const ids = records.map((tag) => typeof tag.id === 'string' ? tag.id : '');
  if (!sameSetWithMultiplicity(ids, Object.keys(TAG_PREREQUISITES))) addOnce(errors, '知识标签必须与 28 个课程合同标签精确相等');
  const tagIds = new Set(ids);
  const graph = new Map<string, string[]>();
  for (const tag of records) {
    if (typeof tag.id !== 'string') continue;
    const prerequisites = readStringArray(tag.prerequisiteTagIds) ?? [];
    graph.set(tag.id, prerequisites);
    if (!sameSetWithMultiplicity(prerequisites, TAG_PREREQUISITES[tag.id] ?? [])) addOnce(errors, `知识标签前置关系不符合课程合同：${tag.id}`);
    if (prerequisites.some((id) => !tagIds.has(id))) addOnce(errors, `知识标签引用不存在的前置标签：${tag.id}`);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    if ((graph.get(id) ?? []).some(visit)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  if ([...graph.keys()].some(visit)) addOnce(errors, '知识标签存在循环前置关系');
  return tagIds;
}

function validateSourceInventory(value: unknown, expectedIds: string[], errors: string[]) {
  const inventory = asRecord(value);
  const records = Array.isArray(inventory?.records) ? inventory.records.map(asRecord) : [];
  const ids = records.map((record) => typeof record?.sourceCourseId === 'string' ? record.sourceCourseId : '');
  if (inventory?.schemaVersion !== 1 || !sameSetWithMultiplicity(ids, expectedIds)) addOnce(errors, '源 API 清单必须恰好包含 46 个唯一课程 ID');
  for (const record of records) {
    const id = typeof record?.sourceCourseId === 'string' ? record.sourceCourseId : '未知';
    const validDate = typeof record?.accessedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.accessedAt);
    const validUrl = typeof record?.sourceUrl === 'string' && isValidHttpsUrl(record.sourceUrl);
    if (typeof record?.sourceTitle !== 'string' || !record.sourceTitle.trim() || !validUrl || !validDate) addOnce(errors, `源 API 清单缺少完整来源信息：${id}`);
    if (!Array.isArray(record?.splSymbols) || !record.splSymbols.every((symbol: unknown) => typeof symbol === 'string' && symbol.trim())) addOnce(errors, `源 API 清单缺少 splSymbols：${id}`);
  }
}

function isValidHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function markdownSections(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = markdown.split(/\r?\n/);
  let heading: string | undefined;
  for (const line of lines) {
    const match = /^#{1,6}\s+(.+?)\s*$/.exec(line);
    if (match) {
      heading = match[1];
      sections.set(heading, '');
    } else if (heading) {
      sections.set(heading, `${sections.get(heading)}\n${line}`);
    }
  }
  return sections;
}

function validateMarkdown(markdown: string, suffix: string, week: number, errors: string[]) {
  const sections = markdownSections(markdown);
  for (const heading of REQUIRED_HEADINGS) {
    if (!sections.has(heading)) addOnce(errors, `周正文缺少章节：${heading}`);
  }
  const sources = sections.get('资料来源') ?? '';
  if (!/https:\/\/\S+/.test(sources) || !/访问日期：\d{4}-\d{2}-\d{2}/.test(sources)) addOnce(errors, `资料来源缺少 HTTPS 链接或访问日期：${suffix}`);
  if (week >= 3 && week <= 22 && !/https:\/\/(?:[^\s/]+\.)?(?:st\.com|dev\.st\.com)(?:\/|\s|$)/i.test(sources)) addOnce(errors, `外设周缺少 ST 官方一手资料：${suffix}`);
}

function validateAssessment(value: unknown, errors: string[], assessmentId: string) {
  const parsed = AssessmentSchema.safeParse(value);
  if (!parsed.success) addOnce(errors, '考核清单结构无效');
  const assessment = asRecord(value);
  const items = Array.isArray(assessment?.items) ? assessment.items.map(asRecord).filter((item): item is Record<string, any> => item !== undefined) : [];
  const expectedTotals: Record<string, number> = { concept: 25, configuration: 25, practical: 35, reflection: 15 };
  const totals: Record<string, number> = {};
  for (const item of items) {
    if (typeof item.kind === 'string' && typeof item.maxScore === 'number') totals[item.kind] = (totals[item.kind] ?? 0) + item.maxScore;
  }
  if (Object.entries(expectedTotals).some(([kind, total]) => totals[kind] !== total)) addOnce(errors, '考核未覆盖四类证据');
  const itemIds = items.map((item) => typeof item.id === 'string' ? item.id : '');
  if (new Set(itemIds).size !== itemIds.length) addOnce(errors, `考核题目 ID 必须唯一：${assessmentId}`);
}

function collectChecks(record: Record<string, any> | undefined): DetectionCheck[] {
  return Array.isArray(record?.detectionChecks)
    ? record.detectionChecks.map(asRecord).filter((check): check is DetectionCheck => check !== undefined)
    : [];
}

type LearningMarkdownKind = 'remediation' | 'extension';

async function validateLearningMarkdownReference(root: string, reference: unknown, kind: LearningMarkdownKind, errors: string[]) {
  const label = kind === 'remediation' ? '补救内容' : '拓展内容';
  const expectedPath = kind === 'remediation'
    ? /^curriculum\/remediation\/[^/]+\.md$/
    : /^curriculum\/extensions\/[^/]+\.md$/;
  if (!RepositoryPathSchema.safeParse(reference).success || typeof reference !== 'string' || !expectedPath.test(reference)) {
    addOnce(errors, `${label}路径无效：${String(reference)}`);
    return;
  }

  let markdown: string;
  try {
    const path = join(root, reference);
    if (!(await stat(path)).isFile()) throw new Error('not a regular file');
    markdown = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(path));
    if (!markdown.trim()) throw new Error('empty file');
  } catch {
    addOnce(errors, `${label}文件无效：${reference}`);
    return;
  }

  const sections = markdownSections(markdown);
  const requiredHeadings = kind === 'remediation'
    ? ['目标', '解释', '微型练习', '检查问题', '通过证据', '返回课程']
    : ['进入条件', '为什么适合继续学习', '起步项目', '尚未掌握', '权威资料'];
  const missingContent = requiredHeadings.some((heading) => !(sections.get(heading) ?? '').trim());
  const authoritativeSources = sections.get('权威资料')?.match(/https:\/\/\S+/g) ?? [];
  if (missingContent || (kind === 'extension' && !authoritativeSources.some(isValidHttpsUrl))) {
    addOnce(errors, `${label} Markdown 合同无效：${reference}`);
  }
}

export async function validateRepositoryContent(root: string, options: RepositoryValidationOptions): Promise<ValidationReport> {
  const errors: string[] = [];
  const courseMapValue = await readJson(join(root, 'curriculum/course-map.json'), errors, '课程地图');
  const courseMapReport = validateCourseMap(courseMapValue);
  errors.push(...courseMapReport.errors);
  const courseMap = CourseMapSchema.safeParse(courseMapValue);
  if (!courseMap.success) return { ok: false, errors: [...new Set(errors)] };

  const inventoryValue = await readJson(join(root, 'curriculum/source-api-inventory.json'), errors, '源 API 清单');
  validateSourceInventory(inventoryValue, courseMap.data.sourceCourseIds, errors);
  const tagValue = await readJson(join(root, 'curriculum/knowledge-tags.json'), errors, '知识标签清单');
  const tagIds = validateTagGraph(tagValue, errors);

  const completeWeeks = Array.from({ length: 24 }, (_, index) => index + 1);
  const selectedWeeks = options.requireCompleteRepository ? completeWeeks : (options.weeks ?? completeWeeks);
  if (selectedWeeks.length === 0 || new Set(selectedWeeks).size !== selectedWeeks.length || selectedWeeks.some((week) => !Number.isInteger(week) || week < 1 || week > 24)) {
    addOnce(errors, '周范围必须是 1–24 之间且不能重复');
    return { ok: false, errors };
  }

  if (options.requireCompleteRepository) {
    try {
      const names = await readdir(join(root, 'curriculum/weeks'));
      const expectedJson = Array.from({ length: 24 }, (_, index) => `w${String(index + 1).padStart(2, '0')}.json`);
      const expectedMarkdown = expectedJson.map((name) => name.replace('.json', '.md'));
      const actualJson = names.filter((name) => /^w\d{2}\.json$/.test(name));
      const actualMarkdown = names.filter((name) => /^w\d{2}\.md$/.test(name));
      if (!sameSetWithMultiplicity(actualJson, expectedJson) || !sameSetWithMultiplicity(actualMarkdown, expectedMarkdown)) addOnce(errors, '必须恰好有 24 个周清单和 24 个周正文');
    } catch {
      addOnce(errors, '必须恰好有 24 个周清单和 24 个周正文');
    }
  }

  const lessons: Record<string, any>[] = [];
  const labs: Record<string, any>[] = [];
  const assessments: Record<string, any>[] = [];
  const knownLessonIds = new Set(courseMap.data.weeks.map((week) => week.lessonIds).flat());

  for (const weekNumber of selectedWeeks) {
    const suffix = `w${String(weekNumber).padStart(2, '0')}`;
    const week = courseMap.data.weeks.find((candidate) => candidate.week === weekNumber);
    if (!week) {
      addOnce(errors, `课程地图缺少第 ${weekNumber} 周`);
      continue;
    }
    const lessonPath = join(root, `curriculum/weeks/${suffix}.json`);
    const markdownPath = join(root, `curriculum/weeks/${suffix}.md`);
    const lessonValue = await readJson(lessonPath, errors, `周清单 ${suffix}`);
    const lessonParsed = LessonManifestSchema.safeParse(lessonValue);
    if (!lessonParsed.success) addOnce(errors, `周清单结构无效：${suffix}`);
    const lesson = asRecord(lessonValue);
    if (!lesson) continue;
    lessons.push(lesson);
    validateDetectionChecks(lesson.detectionChecks, errors);
    if (lesson.week !== weekNumber || !week.lessonIds.includes(lesson.id)) addOnce(errors, `周清单与课程地图不一致：${suffix}`);
    if (!sameSetWithMultiplicity(readStringArray(lesson.sourceCourseIds) ?? [], week.sourceCourseIds)) addOnce(errors, `课程源课程与课程地图不一致：${suffix}`);
    for (const id of week.lessonIds) {
      if (id !== lesson.id) addOnce(errors, `课程地图引用的课程清单不存在：${id}`);
    }
    if (lesson.conceptPath !== `curriculum/weeks/${suffix}.md`) addOnce(errors, `周正文路径不一致：${suffix}`);
    for (const id of [...(readStringArray(lesson.prerequisiteTagIds) ?? []), ...(readStringArray(lesson.targetTagIds) ?? [])]) {
      if (!tagIds.has(id)) addOnce(errors, `课程引用不存在的知识标签：${id}`);
    }
    for (const sourceId of readStringArray(lesson.sourceCourseIds) ?? []) {
      if (!courseMap.data.sourceCourseIds.includes(sourceId)) addOnce(errors, `课程引用未知源课程：${sourceId}`);
    }
    for (const reference of Array.isArray(lesson.remediationPaths) ? lesson.remediationPaths : []) await validateLearningMarkdownReference(root, reference, 'remediation', errors);
    for (const reference of Array.isArray(lesson.extensionPaths) ? lesson.extensionPaths : []) await validateLearningMarkdownReference(root, reference, 'extension', errors);

    try {
      validateMarkdown(await readFile(markdownPath, 'utf8'), suffix, weekNumber, errors);
    } catch {
      if (options.requireCompleteRepository) addOnce(errors, '必须恰好有 24 个周清单和 24 个周正文');
      else addOnce(errors, `周正文不存在：${suffix}`);
    }

    for (const labId of readStringArray(lesson.labIds) ?? []) {
      const labValue = await readJson(join(root, `labs/manifests/${labId}.json`), errors, `实验 ${labId}`);
      const labParsed = LabManifestSchema.safeParse(labValue);
      if (!labParsed.success) addOnce(errors, `实验清单结构无效：${labId}`);
      const lab = asRecord(labValue);
      if (!lab) continue;
      labs.push(lab);
      validateDetectionChecks(lab.detectionChecks, errors);
      if (lab.id !== labId) addOnce(errors, `实验 ID 与引用不一致：${labId}`);
      if (lab.lessonId !== lesson.id) addOnce(errors, `实验引用错误课程：${labId}`);
      const labText = JSON.stringify(lab);
      if (!(readStringArray(lab.safety) ?? []).some((line) => /断电/.test(line))) addOnce(errors, '实验缺少断电接线安全项');
      if (/(电机|舵机|motor|servo)/i.test(labText) && (!/独立供电/.test(labText) || !/共地/.test(labText))) addOnce(errors, '电机或舵机实验必须说明独立供电和共地');
      if (typeof lab.firmwareProject === 'string' && !await directoryExists(join(root, lab.firmwareProject))) addOnce(errors, '固件路径不存在');
    }

    const assessmentId = typeof lesson.assessmentId === 'string' ? lesson.assessmentId : '';
    const assessmentValue = await readJson(join(root, `assessments/question-banks/${assessmentId}.json`), errors, `考核 ${assessmentId}`);
    validateAssessment(assessmentValue, errors, assessmentId);
    const assessment = asRecord(assessmentValue);
    if (assessment) {
      assessments.push(assessment);
      if (assessment.id !== assessmentId) addOnce(errors, `考核 ID 与引用不一致：${assessmentId}`);
      if (assessment.lessonId !== lesson.id) addOnce(errors, `考核引用错误课程：${assessmentId}`);
      for (const item of Array.isArray(assessment.items) ? assessment.items : []) {
        for (const id of readStringArray(asRecord(item)?.tagIds) ?? []) {
          if (!tagIds.has(id)) addOnce(errors, `考核引用不存在的知识标签：${id}`);
        }
      }
    }

    if (week.gateAfter) {
      const gateId = `gate-${String(week.phase).padStart(2, '0')}`;
      const gateValue = await readJson(join(root, `assessments/practicals/${gateId}.json`), errors, `实践考核 ${gateId}`);
      const gate = PracticalGateSchema.safeParse(gateValue);
      if (!gate.success) addOnce(errors, `实践考核结构无效：${gateId}`);
      else {
        if (gate.data.id !== gateId) addOnce(errors, `实践考核 ID 不一致：${gateId}`);
        if (gate.data.phase !== week.phase) addOnce(errors, `实践考核阶段不一致：${gateId}`);
        const phaseLessonIds = courseMap.data.weeks.filter((candidate) => candidate.phase === week.phase).flatMap((candidate) => candidate.lessonIds);
        if (!sameSetWithMultiplicity(gate.data.lessonIds, phaseLessonIds)) addOnce(errors, `实践考核课程集合不一致：${gateId}`);
        for (const lessonId of gate.data.lessonIds) if (!knownLessonIds.has(lessonId)) addOnce(errors, `实践考核引用未知课程：${lessonId}`);
        for (const id of gate.data.requiredTagIds) if (!tagIds.has(id)) addOnce(errors, `实践考核引用不存在的知识标签：${id}`);
        for (const item of gate.data.items) {
          for (const id of item.tagIds) if (!tagIds.has(id)) addOnce(errors, `实践考核引用不存在的知识标签：${id}`);
        }
      }
    }
  }

  const physicalChecksByTag = new Map<string, DetectionCheck[]>();
  for (const tagId of CORE_HARDWARE_TAG_IDS) {
    const matchingLessons = lessons.filter((lesson) => (readStringArray(lesson.targetTagIds) ?? []).includes(tagId));
    const lessonIds = new Set(matchingLessons.map((lesson) => lesson.id));
    physicalChecksByTag.set(tagId, [...matchingLessons.flatMap(collectChecks), ...labs.filter((lab) => lessonIds.has(lab.lessonId)).flatMap(collectChecks)]);
  }
  for (const [tagId, checks] of physicalChecksByTag) {
    if (!options.requireCompleteRepository && checks.length === 0) continue;
    if (!checks.some((check) => check.mode === 'semi-automatic' && check.applicable === true && check.evidenceSource === 'device' && check.physicalHardware === true)) addOnce(errors, `核心硬件主题缺少设备半自动物理证据：${tagId}`);
    if (!checks.some((check) => check.mode === 'manual' && check.applicable === true && check.evidenceSource === 'manual' && check.physicalHardware === true)) addOnce(errors, `核心硬件主题缺少人工物理证据：${tagId}`);
  }

  if (options.requireCompleteRepository) {
    const mappedSources = new Set(courseMap.data.weeks.flatMap((week) => week.sourceCourseIds));
    if (EXPECTED_SOURCE_IDS.some((id) => !mappedSources.has(id))) addOnce(errors, '源课程未被周清单引用');
    const coverage = new Map(REQUIRED_TOPICS.map((id) => [id, { lesson: false, lab: false, fault: false, assessment: false } as CoreCoverage]));
    for (const lesson of lessons) {
      const lessonTags = readStringArray(lesson.targetTagIds) ?? [];
      const linkedLabs = labs.filter((lab) => lab.lessonId === lesson.id);
      const assessment = assessments.find((candidate) => candidate.lessonId === lesson.id);
      for (const id of lessonTags) {
        const item = coverage.get(id);
        if (!item) continue;
        item.lesson = true;
        item.lab ||= linkedLabs.length > 0;
        item.fault ||= linkedLabs.some((lab) => Array.isArray(lab.faultTasks) && lab.faultTasks.length > 0);
        item.assessment ||= (Array.isArray(assessment?.items) ? assessment.items : []).some((question) => (readStringArray(asRecord(question)?.tagIds) ?? []).includes(id));
      }
    }
    if ([...coverage.values()].some((item) => !item.lesson)) addOnce(errors, '核心主题缺少课程');
    if ([...coverage.values()].some((item) => !item.lab)) addOnce(errors, '核心主题缺少实验');
    if ([...coverage.values()].some((item) => !item.fault)) addOnce(errors, '核心主题缺少故障任务');
    if ([...coverage.values()].some((item) => !item.assessment)) addOnce(errors, '核心主题缺少考核');
  }

  return { ok: errors.length === 0, errors };
}

export function parseWeekSelection(args: string[]): number[] | undefined {
  const index = args.indexOf('--weeks');
  if (index < 0) return undefined;
  const value = args[index + 1];
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(value ?? '');
  if (!match) throw new Error('--weeks 必须使用起止范围，例如 1-4');
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (start < 1 || end > 24 || start > end) throw new Error('--weeks 必须位于 1–24 且起点不大于终点');
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

async function main() {
  try {
    const weeks = parseWeekSelection(process.argv.slice(2));
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const report = await validateRepositoryContent(root, { weeks, requireCompleteRepository: weeks === undefined });
    if (!report.ok) {
      console.error(report.errors.map((error) => `- ${error}`).join('\n'));
      process.exitCode = 1;
      return;
    }
    console.log(weeks
      ? `内容验证通过：第 ${weeks[0]}–${weeks[weeks.length - 1]} 周及其引用内容。`
      : '内容验证通过：24 周，46 份源课程，全部核心主题与证据合同。');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) void main();
