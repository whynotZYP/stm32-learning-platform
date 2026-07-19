import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CourseMapSchema } from '../../web/src/domain/content/schemas';

export interface ValidationReport {
  ok: boolean;
  errors: string[];
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

interface ReadableCourseMap {
  sourceCourseIds?: string[];
  requiredTagIds?: string[];
  weekNumbers?: number[];
  mappedSourceIds?: string[];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
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

  if (data.weekNumbers !== undefined && [...data.weekNumbers].sort((a, b) => a - b).join(',') !== expectedWeeks.join(',')) {
    errors.push('周编号必须恰好覆盖 1–24，不能重复');
  }

  const expectedSources = [...EXPECTED_SOURCE_IDS].sort();
  if (data.sourceCourseIds !== undefined && [...data.sourceCourseIds].sort().join(',') !== expectedSources.join(',')) {
    errors.push('源课程必须完整覆盖 05–49，并包含 06-1/06-2，共 46 份');
  }

  if (data.mappedSourceIds !== undefined) {
    const mappedSources = new Set(data.mappedSourceIds);
    const unknownMapped = [...new Set(data.mappedSourceIds.filter((id) => !EXPECTED_SOURCE_IDS.includes(id)))].sort();
    if (unknownMapped.length) {
      errors.push(`周映射包含未知源课程：${unknownMapped.join(', ')}`);
    }

    const unmapped = EXPECTED_SOURCE_IDS.filter((id) => !mappedSources.has(id));
    if (unmapped.length) {
      errors.push(`未映射源课程：${unmapped.join(', ')}`);
    }
  }

  const expectedTopics = [...REQUIRED_TOPICS].sort();
  if (data.requiredTagIds !== undefined && [...data.requiredTagIds].sort().join(',') !== expectedTopics.join(',')) {
    errors.push('核心主题必须与规定主题精确相等，不能缺少、额外或重复');
  }

  return { ok: errors.length === 0, errors };
}

async function main() {
  const path = fileURLToPath(new URL('../../curriculum/course-map.json', import.meta.url));
  const report = validateCourseMap(JSON.parse(await readFile(path, 'utf8')));
  if (!report.ok) {
    console.error(report.errors.map((error) => `- ${error}`).join('\n'));
    process.exitCode = 1;
    return;
  }

  console.log('内容地图验证通过：24 周，46 份源课程，13 个核心主题。');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) void main();
