import { describe, expect, it } from 'vitest';
import type { Assessment } from '../content/types';
import { gradeAssessment } from './gradeAssessment';

const assessment: Assessment = {
  schemaVersion: 1,
  id: 'entry-diagnostic',
  lessonId: 'entry-diagnostic',
  items: [
    { id: 'objective', kind: 'configuration', prompt: '请选择正确的位编号。', tagIds: ['foundation.binary'], maxScore: 25, answer: '第3位', rubric: ['规则说明足够清楚。'] },
    { id: 'manual', kind: 'reflection', prompt: '写出一条可观察的程序证据。', tagIds: ['c.control-flow'], maxScore: 15, rubric: ['规则说明足够清楚。'] },
  ],
};

describe('gradeAssessment', () => {
  it('creates assessment evidence with each objective item kind and tags', () => {
    expect(gradeAssessment(assessment, { objective: { score: 25, response: ' 第3位 ' } }, '2026-07-19T00:00:00.000Z')[0]).toMatchObject({
      id: 'assessment-entry-diagnostic-objective-2026-07-19T00:00:00.000Z', learnerId: 'local', lessonId: 'entry-diagnostic',
      tagIds: ['foundation.binary'], kind: 'configuration', status: 'auto-pass', score: 100, source: 'assessment',
      details: { prompt: '请选择正确的位编号。', response: ' 第3位 ', maxScore: 25 },
    });
  });

  it('records missing or blank answers as failed zero-score evidence', () => {
    const records = gradeAssessment(assessment, { objective: { score: 25, response: '   ' } }, '2026-07-19T00:00:00.000Z');
    expect(records).toHaveLength(2);
    expect(records.map((record) => [record.status, record.score])).toEqual([['failed', 0], ['failed', 0]]);
  });

  it('clamps finite manual scores, normalizes them, and preserves inputs without mutation', () => {
    const answers = { objective: { score: Number.POSITIVE_INFINITY, response: '第3位' }, manual: { score: 20, response: '串口打印固定数据。' } };
    const before = structuredClone(answers);
    const records = gradeAssessment(assessment, answers, '2026-07-19T00:00:00.000Z');
    expect(records.map((record) => [record.status, record.score])).toEqual([['failed', 0], ['manual-confirmed', 100]]);
    expect(answers).toEqual(before);
  });

  it('uses explicit trim-and-case-insensitive objective matching and unique deterministic IDs', () => {
    const records = gradeAssessment(assessment, { objective: { score: 1, response: ' 第3位 ' }, manual: { score: 1, response: 'x' } }, '2026-07-19T00:00:00.000Z');
    expect(records.map((record) => record.id)).toEqual(['assessment-entry-diagnostic-objective-2026-07-19T00:00:00.000Z', 'assessment-entry-diagnostic-manual-2026-07-19T00:00:00.000Z']);
  });
});
