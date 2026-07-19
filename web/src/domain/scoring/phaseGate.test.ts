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
      '闃舵骞冲潎鍒?70锛岃姹傝嚦灏?75',
      '瀹炴搷骞冲潎鍒?60锛岃姹傝嚦灏?70',
      '鍓嶇疆鏍囩 adc 涓?69锛岃姹傝嚦灏?70',
      '鍓嶇疆鏍囩 gpio 涓?65锛岃姹傝嚦灏?70',
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
      reasons: [
        '闃舵骞冲潎鍒?0锛岃姹傝嚦灏?75',
        '瀹炴搷骞冲潎鍒?0锛岃姹傝嚦灏?70',
      ],
    });
    expect(input).toEqual({ phaseId: 1, lessonScores: [], practicalScores: [], prerequisiteScores: {} });
  });
});
