export interface NoteExportInput {
  lessonId: string;
  week: number;
  date: string;
  tags: string[];
  objectives: string[];
  cubeMxDecisions: string;
  wiringAndSafety: string;
  codeAndDataFlow: string;
  faults: string;
  evidence: string;
  reflection: string;
}

const sectionNames = ['学习目标', 'CubeMX 决策', '接线与安全', '代码与数据流', '故障记录', '测试证据', '复盘'] as const;

function learnerText(value: string) {
  return value.replace(/---/g, '\\---');
}

function filenamePart(value: string, fallback: string) {
  const safe = value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
  return safe || fallback;
}

export function toMarkdownNote(input: NoteExportInput): { filename: string; markdown: string } {
  const sections = [
    input.objectives.map((item) => `- ${learnerText(item)}`).join('\n'),
    learnerText(input.cubeMxDecisions),
    learnerText(input.wiringAndSafety),
    learnerText(input.codeAndDataFlow),
    learnerText(input.faults),
    learnerText(input.evidence),
    learnerText(input.reflection),
  ];
  const markdown = [
    '---',
    `lessonId: ${JSON.stringify(learnerText(input.lessonId))}`,
    `week: ${input.week}`,
    `date: ${JSON.stringify(learnerText(input.date))}`,
    `tags: ${JSON.stringify(input.tags.map(learnerText))}`,
    '---',
    ...sectionNames.flatMap((title, index) => [`## ${title}`, sections[index], '']),
  ].join('\n');

  return {
    filename: `${filenamePart(input.date, 'note')}-${filenamePart(input.lessonId, 'lesson')}.md`,
    markdown,
  };
}
