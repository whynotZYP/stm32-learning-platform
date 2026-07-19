import { describe, expect, it } from 'vitest';
import type { TagMastery } from '../scoring/mastery';
import { buildDiagnosticPath } from './buildDiagnosticPath';

const tagIds = ['foundation.electricity', 'foundation.binary', 'c.control-flow', 'c.memory', 'gpio.output-mode'];
const mastery = (ids: string[], score = 85): TagMastery[] => ids.map((tagId) => ({ tagId, score, band: 'mastered', evidenceIds: [] }));

describe('buildDiagnosticPath', () => {
  it('starts at week 1 without enough foundation evidence', () => {
    expect(buildDiagnosticPath([])).toEqual({ recommendedWeek: 1, validationTaskIds: [], reasons: ['基础标签尚未全部达到 85；从第 1 周建立安全和数制基础。'] });
  });

  it('recommends week 3 with a practical validation after the four foundation tags', () => {
    expect(buildDiagnosticPath(mastery(tagIds.slice(0, 4)))).toMatchObject({ recommendedWeek: 3, validationTaskIds: ['lab-w03-first-project'] });
  });

  it('recommends week 5 only after all five tags are mastered', () => {
    expect(buildDiagnosticPath(mastery(tagIds))).toMatchObject({ recommendedWeek: 5, validationTaskIds: ['gate-01-practical'] });
  });

  it('keeps the lowest duplicate score and treats invalid scores as unmastered', () => {
    expect(buildDiagnosticPath([
      ...mastery(tagIds.slice(0, 4)),
      { tagId: 'foundation.electricity', score: 40, band: 'relearn', evidenceIds: [] },
      { tagId: 'gpio.output-mode', score: Number.POSITIVE_INFINITY, band: 'mastered', evidenceIds: [] },
    ])).toMatchObject({ recommendedWeek: 1, validationTaskIds: [] });
  });
});
