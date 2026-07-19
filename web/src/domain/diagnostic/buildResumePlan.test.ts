import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../progress/defaultState';
import type { TagMastery } from '../scoring/mastery';
import { buildResumePlan } from './buildResumePlan';

const item = (tagId: string, score: number): TagMastery => ({ tagId, score, band: score >= 85 ? 'mastered' : 'review', evidenceIds: [] });

describe('buildResumePlan', () => {
  it('does not require recall for a seven-day-or-shorter pause', () => {
    const state = { ...createDefaultState('2026-07-12T00:00:00.000Z'), currentWeek: 4 };
    expect(buildResumePlan(state, [item('a', 70)], '2026-07-19T00:00:00.000Z')).toEqual({ needsRecall: false, currentWeek: 4, durationMinutes: 0, recallTagIds: [] });
  });

  it('selects the weakest three mastered or review tags in score then tag order after a longer pause', () => {
    const state = { ...createDefaultState('2026-07-01T00:00:00.000Z'), currentWeek: 8 };
    const mastery = [item('zeta', 71), item('beta', 70), item('alpha', 70), item('high', 95), item('low', 69), { ...item('inconsistent', 90), band: 'relearn' as const }];
    const before = structuredClone(mastery);
    expect(buildResumePlan(state, mastery, '2026-07-19T00:00:00.000Z')).toEqual({ needsRecall: true, currentWeek: 8, durationMinutes: 10, recallTagIds: ['alpha', 'beta', 'zeta'] });
    expect(mastery).toEqual(before);
  });

  it('rejects invalid dates and non-finite scores but treats a future timestamp as no recall', () => {
    const state = createDefaultState('not-a-date');
    expect(() => buildResumePlan(state, [], '2026-07-19T00:00:00.000Z')).toThrow('日期无效');
    expect(buildResumePlan(createDefaultState('2026-07-20T00:00:00.000Z'), [], '2026-07-19T00:00:00.000Z')).toEqual({ needsRecall: false, currentWeek: 1, durationMinutes: 0, recallTagIds: [] });
    expect(() => buildResumePlan(createDefaultState('2026-07-01T00:00:00.000Z'), [item('bad', Number.NaN)], '2026-07-19T00:00:00.000Z')).toThrow('掌握分数无效');
  });
});
