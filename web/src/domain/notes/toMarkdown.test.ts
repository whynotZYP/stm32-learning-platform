import { describe, expect, it } from 'vitest';
import { toMarkdownNote } from './toMarkdown';

describe('toMarkdownNote', () => {
  it('renders deterministic safe frontmatter and all note sections', () => {
    const input = {
      lessonId: 'w04:gpi/o', week: 4, date: '2026-07-19', tags: ['gpio:---output', 'line\nbreak'],
      objectives: ['点亮 LED', '记录 --- 分隔符'], cubeMxDecisions: 'PA0 设为 --- 输出', wiringAndSafety: '断电接线',
      codeAndDataFlow: 'main() -> HAL_GPIO_WritePin', faults: '无', evidence: '串口: OK', reflection: '下次更快',
    };
    const { filename, markdown } = toMarkdownNote(input);
    expect(filename).toBe('2026-07-19-w04_gpi_o.md');
    expect(markdown.startsWith('---\nlessonId: "w04:gpi/o"\nweek: 4\ndate: "2026-07-19"\ntags: ["gpio:\\\\---output","line\\nbreak"]\n---\n')).toBe(true);
    expect(markdown).toContain('记录 \\--- 分隔符');
    expect(markdown).toContain('PA0 设为 \\--- 输出');
    expect(markdown).not.toContain('gpio:---output');
    expect(markdown.match(/^---$/gm)).toHaveLength(2);
    expect(markdown.match(/^## .+$/gm)).toEqual([
      '## 学习目标', '## CubeMX 决策', '## 接线与安全', '## 代码与数据流', '## 故障记录', '## 测试证据', '## 复盘',
    ]);
  });

  it('does not mutate learner input and keeps empty sections as a usable template', () => {
    const input = { lessonId: 'w04', week: 4, date: '2026-07-19', tags: [], objectives: [], cubeMxDecisions: '', wiringAndSafety: '', codeAndDataFlow: '', faults: '', evidence: '', reflection: '' };
    const original = structuredClone(input);
    const result = toMarkdownNote(input);
    expect(input).toEqual(original);
    expect(result.markdown).toContain('tags: []');
    expect(result.markdown.match(/^## /gm)).toHaveLength(7);
  });
});
