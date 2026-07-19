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

export function validateCourseMap(input: unknown): ValidationReport {
  const parsed = CourseMapSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: [
        '课程地图结构无效',
        ...parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      ],
    };
  }

  const errors: string[] = [];
  const data = parsed.data;
  const weeks = [...data.weeks.map((week) => week.week)].sort((a, b) => a - b);
  const expectedWeeks = Array.from({ length: 24 }, (_, index) => index + 1);
  if (weeks.join(',') !== expectedWeeks.join(',')) {
    errors.push('周编号必须恰好覆盖 1–24，不能重复');
  }

  const actualSources = [...new Set(data.sourceCourseIds)].sort();
  const expectedSources = [...EXPECTED_SOURCE_IDS].sort();
  if (actualSources.join(',') !== expectedSources.join(',')) {
    errors.push('源课程必须完整覆盖 05–49，并包含 06-1/06-2，共 46 份');
  }

  const mappedSources = new Set(data.weeks.flatMap((week) => week.sourceCourseIds));
  const unmapped = EXPECTED_SOURCE_IDS.filter((id) => !mappedSources.has(id));
  if (unmapped.length) {
    errors.push(`未映射源课程：${unmapped.join(', ')}`);
  }

  const missingTopics = REQUIRED_TOPICS.filter((topic) => !data.requiredTagIds.includes(topic));
  if (missingTopics.length) {
    errors.push(`缺少核心主题：${missingTopics.join(', ')}`);
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
