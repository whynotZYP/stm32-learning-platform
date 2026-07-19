import type { LearnerState } from './types';

export function createDefaultState(now = new Date().toISOString()): LearnerState {
  return {
    schemaVersion: 1,
    learnerId: 'local',
    currentWeek: 1,
    lessonProgress: {},
    evidence: [],
    remediationQueue: [],
    notes: {},
    completedPhaseIds: [],
    updatedAt: now,
  };
}
