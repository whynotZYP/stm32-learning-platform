import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toMarkdownNote } from '../../web/src/domain/notes/toMarkdown';

const ROOT = process.cwd();
const RUBRIC_CATEGORIES = [
  ['概念理解', 25],
  ['配置与工具', 25],
  ['实操作品', 35],
  ['复盘表达', 15],
] as const;
const LEVELS = ['0', '25', '50', '75', '100'];
const MAP_GROUPS = ['GPIO', 'EXTI / NVIC', 'TIM 基础与 PWM', 'ADC', 'DMA', 'USART', 'I2C', 'SPI', 'RTC / BKP / PWR', 'IWDG / WWDG'];
const REMEDIATION_TAGS: Record<string, string[]> = {
  'concept-breakdown.md': ['toolchain.build-debug'],
  'signal-to-register-gpio-exti.md': ['gpio.output-mode', 'exti.event-flow'],
  'signal-to-register-tim-adc-dma.md': ['tim.timebase', 'adc.sampling', 'dma.transfer'],
  'shared-protocol-foundation.md': ['usart.physical-frame', 'i2c.protocol', 'spi.protocol'],
  'minimal-lab-wiring.md': ['debug.observation'],
  'prerequisite-electricity.md': ['foundation.electricity'],
  'prerequisite-binary-c.md': ['foundation.binary', 'c.control-flow'],
  'prerequisite-memory-map.md': ['c.memory', 'mcu.memory-map'],
  'watchdog-recovery.md': ['wdg.recovery'],
  'flash-safety.md': ['flash.persistence'],
};

async function text(relativePath: string) {
  return readFile(join(ROOT, relativePath), 'utf8');
}

function markdownSection(markdown: string, heading: string) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.indexOf(`## ${heading}`);
  if (start < 0) return '';
  const next = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines.slice(start + 1, next < 0 ? undefined : next).join('\n').trim();
}

function parseSourceMap(markdown: string) {
  const rows: { symbol: string; cells: string[]; group: string }[] = [];
  let group = '';
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith('## ')) group = line.slice(3).trim();
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    const symbol = cells[0]?.match(/^`([^`]+)`$/)?.[1];
    if (symbol) rows.push({ symbol, cells, group });
  }
  return rows;
}

describe('Task 8 common curriculum artifacts', () => {
  it('defines observable 0/25/50/75/100 anchors for the exact 25/25/35/15 rubric', async () => {
    const rubric = await text('assessments/rubrics/common-rubric.md');
    expect(rubric).toContain('总分 = 概念理解 25% + 配置与工具 25% + 实操作品 35% + 复盘表达 15%');
    for (const [category, weight] of RUBRIC_CATEGORIES) {
      const section = markdownSection(rubric, `${category}（${weight}%）`);
      const anchors = section.split(/\r?\n/)
        .filter((line) => /^\|\s*(0|25|50|75|100)\s*\|/.test(line))
        .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
      expect(anchors.map(([level]) => level), category).toEqual(LEVELS);
      expect(anchors.every(([, anchor]) => anchor.length >= 12), category).toBe(true);
    }
  });

  it('keeps the weekly note byte-for-byte aligned with an empty toMarkdownNote export', async () => {
    const expected = toMarkdownNote({
      lessonId: '', week: 0, date: '', tags: [], objectives: [], cubeMxDecisions: '', wiringAndSafety: '',
      codeAndDataFlow: '', faults: '', evidence: '', reflection: '',
    }).markdown;
    expect(await text('notes/templates/weekly-note.md')).toBe(expected);
  });

  it('locks the versioned inventory at 46 records and 109 unique non-empty SPL symbols', async () => {
    const inventory = JSON.parse(await text('curriculum/source-api-inventory.json')) as { records: { splSymbols: string[] }[] };
    const symbols = inventory.records.flatMap((record) => record.splSymbols).filter((symbol) => symbol.trim());
    expect(inventory.records).toHaveLength(46);
    expect(new Set(symbols).size).toBe(109);
  });

  it('maps each inventory SPL symbol in exactly one first-column table row', async () => {
    const inventory = JSON.parse(await text('curriculum/source-api-inventory.json')) as { records: { splSymbols: string[] }[] };
    const expected = [...new Set(inventory.records.flatMap((record) => record.splSymbols).filter((symbol) => symbol.trim()))].sort();
    const sourceMap = await text('docs/references/spl-to-hal-map.md');
    const rows = parseSourceMap(sourceMap);
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.symbol, (counts.get(row.symbol) ?? 0) + 1);
    const missing = expected.filter((symbol) => !counts.has(symbol));
    const duplicate = [...counts].filter(([, count]) => count !== 1).map(([symbol]) => symbol);
    expect(missing, 'inventory symbols without a first-column row').toEqual([]);
    expect(duplicate, 'symbols with duplicate first-column rows').toEqual([]);
    expect(rows).toHaveLength(109);
    expect(rows.map((row) => row.symbol).sort()).toEqual(expected);
    expect([...new Set(rows.map((row) => row.group))]).toEqual(MAP_GROUPS);
    expect(rows.every((row) => row.cells.length === 5 && row.cells.every(Boolean))).toBe(true);
    expect(sourceMap).toContain('curriculum/source-api-inventory.json');
    expect(sourceMap).toContain('46 条记录');
    expect(sourceMap).toContain('109 个');
  });

  it('provides exactly ten bounded remediation modules with a failed-tag return link', async () => {
    const directory = join(ROOT, 'curriculum/remediation');
    expect((await readdir(directory)).sort()).toEqual(Object.keys(REMEDIATION_TAGS).sort());
    const expectedHeadings = ['目标', '解释', '微型练习', '检查问题', '通过证据', '返回课程'];
    for (const [filename, tags] of Object.entries(REMEDIATION_TAGS)) {
      const markdown = await readFile(join(directory, filename), 'utf8');
      expect(markdown.match(/^## .+$/gm)?.map((line) => line.slice(3))).toEqual(expectedHeadings);
      const minutes = Number(markdownSection(markdown, '目标').match(/预计时间：([0-9]+) 分钟/)?.[1]);
      expect(minutes, filename).toBeGreaterThanOrEqual(20);
      expect(minutes, filename).toBeLessThanOrEqual(40);
      for (const heading of expectedHeadings.slice(0, 5)) expect(markdownSection(markdown, heading).length, `${filename}: ${heading}`).toBeGreaterThan(12);
      expect(markdownSection(markdown, '检查问题'), filename).toContain('？');
      const returnSection = markdownSection(markdown, '返回课程');
      for (const tag of tags) expect(returnSection, `${filename}: ${tag}`).toMatch(new RegExp(`\\[返回失败标签：${tag.replace('.', '\\.')}\\]\\([^)]+\\)`));
    }
  });
});
