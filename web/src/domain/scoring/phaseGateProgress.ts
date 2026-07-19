import type { LearnerState, LessonProgress, RemediationItem } from '../progress/types';
import { buildRemediationQueue } from '../remediation/buildRemediationQueue';
import { calculateLessonScore } from './lessonScore';
import { calculateTagMastery, type TagMastery } from './mastery';
import { evaluatePhaseGate, type PhaseGateResult } from './phaseGate';

export interface PhaseGateProgress {
  gate: PhaseGateResult;
  prerequisiteMastery: TagMastery[];
  remediation: RemediationItem[];
}

function scoreLesson(progress: LessonProgress | undefined) {
  try {
    return calculateLessonScore(progress?.rubricScores ?? {});
  } catch {
    return 0;
  }
}

function scorePractical(progress: LessonProgress | undefined) {
  try {
    calculateLessonScore(progress?.rubricScores ?? {});
    return progress?.rubricScores.practical ?? 0;
  } catch {
    return 0;
  }
}

export function derivePhaseGateProgress({
  phaseId, lessonIds, prerequisiteTagIds, state,
}: { phaseId: number; lessonIds: string[]; prerequisiteTagIds: string[]; state: LearnerState }): PhaseGateProgress {
  const acceptedPrerequisiteEvidence = state.evidence.filter((record) => (
    record.status === 'auto-pass' || record.status === 'manual-confirmed'
  ));
  const prerequisiteMastery = prerequisiteTagIds.map((tagId) => calculateTagMastery(tagId, acceptedPrerequisiteEvidence));
  const gate = evaluatePhaseGate({
    phaseId,
    lessonScores: lessonIds.map((lessonId) => scoreLesson(state.lessonProgress[lessonId])),
    practicalScores: lessonIds.map((lessonId) => scorePractical(state.lessonProgress[lessonId])),
    prerequisiteScores: Object.fromEntries(prerequisiteMastery.map((item) => [item.tagId, item.score])),
  });
  return { gate, prerequisiteMastery, remediation: buildRemediationQueue(prerequisiteMastery) };
}
