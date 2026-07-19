import { describe, expect, it } from 'vitest';
import { calculateLessonScore } from './lessonScore';

describe('calculateLessonScore', () => {
  it('uses 25/25/35/15 weights and rounds once', () => {
    expect(calculateLessonScore({ concept: 80, configuration: 60, practical: 100, reflection: 40 })).toBe(76);
  });

  it('rounds the final weighted total once', () => {
    expect(calculateLessonScore({ concept: 2, configuration: 0, practical: 100, reflection: 0 })).toBe(36);
  });

  it('accepts score boundaries of 0 and 100', () => {
    expect(calculateLessonScore({ concept: 0, configuration: 100, practical: 0, reflection: 100 })).toBe(40);
  });

  it('does not award a completed score while a rubric dimension is absent', () => {
    expect(() => calculateLessonScore({ concept: 80, configuration: 80, practical: 80 })).toThrow('缺少评分项：reflection');
  });

  it('reports the first missing rubric dimension for empty input', () => {
    expect(() => calculateLessonScore({})).toThrow('缺少评分项：concept');
  });

  it.each([
    ['concept', -0.01],
    ['reflection', 100.01],
  ] as const)('rejects an out-of-range %s score', (kind, value) => {
    expect(() => calculateLessonScore({ concept: 80, configuration: 80, practical: 80, reflection: 80, [kind]: value })).toThrow();
  });
});
