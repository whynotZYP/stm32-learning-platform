import { describe, expect, it } from 'vitest';
import { evaluatePhaseGate } from './phaseGate';

describe('evaluatePhaseGate', () => {
  it('passes at the exact threshold when every prerequisite passes', () => {
    expect(evaluatePhaseGate({
      phaseId: 1,
      lessonScores: [75, 75],
      practicalScores: [70, 70],
      prerequisiteScores: { gpio: 70 },
    })).toMatchObject({
      phaseId: 1,
      passed: true,
      phaseAverage: 75,
      practicalAverage: 70,
      reasons: [],
    });
  });

  it('explains every failed threshold in phase, practical, prerequisite order', () => {
    const result = evaluatePhaseGate({
      phaseId: 1,
      lessonScores: [70],
      practicalScores: [60],
      prerequisiteScores: { gpio: 65, adc: 69 },
    });

    expect(result).toMatchObject({ phaseId: 1, passed: false, phaseAverage: 70, practicalAverage: 60 });
    expect(result.reasons).toEqual([
      '阶段平均分 70，要求至少 75',
      '实操平均分 60，要求至少 70',
      '前置标签 adc 为 69，要求至少 70',
      '前置标签 gpio 为 65，要求至少 70',
    ]);
  });

  it.each([
    ['lesson', { lessonScores: [74], practicalScores: [70], prerequisiteScores: { gpio: 70 } }],
    ['practical', { lessonScores: [75], practicalScores: [69], prerequisiteScores: { gpio: 70 } }],
    ['prerequisite', { lessonScores: [75], practicalScores: [70], prerequisiteScores: { gpio: 69 } }],
  ])('fails when only the %s threshold is below its boundary', (_threshold, scores) => {
    expect(evaluatePhaseGate({ phaseId: 1, ...scores }).passed).toBe(false);
  });

  it('treats empty score and prerequisite collections as averages of zero without mutating input', () => {
    const input = { phaseId: 1, lessonScores: [], practicalScores: [], prerequisiteScores: {} };

    expect(evaluatePhaseGate(input)).toMatchObject({
      passed: false,
      phaseAverage: 0,
      practicalAverage: 0,
      reasons: ['阶段平均分 0，要求至少 75', '实操平均分 0，要求至少 70'],
    });
    expect(input).toEqual({ phaseId: 1, lessonScores: [], practicalScores: [], prerequisiteScores: {} });
  });

  it('rounds only the final lesson average', () => {
    expect(evaluatePhaseGate({
      phaseId: 1,
      lessonScores: [74.49, 74.49, 75.49],
      practicalScores: [70],
      prerequisiteScores: {},
    }).phaseAverage).toBe(75);
  });

  it.each([Number.NaN, Infinity, -Infinity, -0.01, 100.01])('rejects invalid lesson score %s', (score) => {
    expect(() => evaluatePhaseGate({
      phaseId: 1,
      lessonScores: [score],
      practicalScores: [70],
      prerequisiteScores: {},
    })).toThrow('课程分数必须是 0 到 100 之间的有限数值');
  });

  it.each([Number.NaN, Infinity, -Infinity, -0.01, 100.01])('rejects invalid practical score %s', (score) => {
    expect(() => evaluatePhaseGate({
      phaseId: 1,
      lessonScores: [75],
      practicalScores: [score],
      prerequisiteScores: {},
    })).toThrow('实操分数必须是 0 到 100 之间的有限数值');
  });

  it.each([Number.NaN, Infinity, -Infinity, -0.01, 100.01])('rejects invalid prerequisite score %s', (score) => {
    expect(() => evaluatePhaseGate({
      phaseId: 1,
      lessonScores: [75],
      practicalScores: [70],
      prerequisiteScores: { gpio: score },
    })).toThrow('前置标签 gpio 的分数必须是 0 到 100 之间的有限数值');
  });
});
