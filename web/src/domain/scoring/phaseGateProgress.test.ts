import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../progress/defaultState';
import type { EvidenceRecord, LessonProgress } from '../progress/types';
import { derivePhaseGateProgress } from './phaseGateProgress';

const lessonIds = ['w01', 'w02', 'w03', 'w04'];
const prerequisites = ['foundation.electricity', 'foundation.binary', 'c.control-flow', 'c.memory', 'gpio.output-mode'];
const complete = (scores: LessonProgress['rubricScores']): LessonProgress => ({ lessonId: 'unused', status: 'completed', rubricScores: scores });

function derive(lessonProgress: Record<string, LessonProgress>, evidence: EvidenceRecord[] = []) {
  const state = { ...createDefaultState(), lessonProgress, evidence };
  return derivePhaseGateProgress({ phaseId: 1, lessonIds, prerequisiteTagIds: prerequisites, state });
}

describe('derivePhaseGateProgress', () => {
  it('uses calculateLessonScore weights for every Phase 1 course', () => {
    const score = { concept: 100, configuration: 0, practical: 100, reflection: 0 } as const;
    const result = derive(Object.fromEntries(lessonIds.map((lessonId) => [lessonId, { ...complete(score), lessonId }])));
    expect(result.gate.phaseAverage).toBe(60);
    expect(result.gate.practicalAverage).toBe(100);
  });

  it('counts a lesson with any missing rubric as zero while retaining all four courses', () => {
    const progress = Object.fromEntries(lessonIds.map((lessonId, index) => [lessonId, {
      ...complete(index === 0 ? { concept: 100, configuration: 100, practical: 100, reflection: 100 } : { practical: 100 }), lessonId,
    }]));
    const result = derive(progress);
    expect(result.gate.phaseAverage).toBe(25);
    expect(result.gate.practicalAverage).toBe(25);
  });

  it('does not let pending or failed evidence scores raise lesson or practical averages', () => {
    const highEvidence: EvidenceRecord[] = ['pending', 'failed'].map((status, index) => ({
      id: `raw-${status}`, learnerId: 'local', lessonId: lessonIds[index], tagIds: prerequisites, kind: 'practical', status: status as EvidenceRecord['status'],
      score: 100, source: 'assessment', createdAt: '2026-07-19T00:00:00.000Z', details: {},
    }));
    const result = derive({}, highEvidence);
    expect(result.gate.phaseAverage).toBe(0);
    expect(result.gate.practicalAverage).toBe(0);
  });

  it('limits remediation to Phase 1 prerequisites and three concrete items', () => {
    const unrelated: EvidenceRecord = {
      id: 'future', learnerId: 'local', lessonId: 'w20', tagIds: ['spi.protocol'], kind: 'concept', status: 'auto-pass',
      score: 0, source: 'assessment', createdAt: '2026-07-19T00:00:00.000Z', details: {},
    };
    const result = derive({}, [unrelated]);
    expect(result.remediation).toHaveLength(3);
    expect(result.remediation.every((item) => prerequisites.includes(item.tagId))).toBe(true);
    expect(result.remediation.some((item) => item.tagId === 'spi.protocol')).toBe(false);
  });

  it('rejects failed or pending prerequisite evidence but keeps accepted evidence', () => {
    const fullProgress = Object.fromEntries(lessonIds.map((lessonId) => [lessonId, {
      ...complete({ concept: 100, configuration: 100, practical: 100, reflection: 100 }), lessonId,
    }]));
    const disallowed: EvidenceRecord[] = prerequisites.flatMap((tagId) => (['failed', 'pending'] as const).map((status) => ({
      id: `${status}-${tagId}`, learnerId: 'local', lessonId: 'entry-diagnostic', tagIds: [tagId], kind: 'concept', status,
      score: 100, source: 'assessment', createdAt: '2026-07-19T00:00:00.000Z', details: {},
    })));
    const rejected = derive(fullProgress, disallowed);
    expect(rejected.prerequisiteMastery.every((item) => item.score === 0)).toBe(true);
    expect(rejected.gate.passed).toBe(false);
    expect(rejected.remediation).toHaveLength(3);
    expect(rejected.remediation.every((item) => prerequisites.includes(item.tagId))).toBe(true);

    const accepted: EvidenceRecord[] = prerequisites.map((tagId) => ({
      id: `accepted-${tagId}`, learnerId: 'local', lessonId: 'entry-diagnostic', tagIds: [tagId], kind: 'concept', status: 'auto-pass',
      score: 100, source: 'assessment', createdAt: '2026-07-19T00:00:00.000Z', details: {},
    }));
    expect(derive(fullProgress, accepted).gate.passed).toBe(true);
  });
});
