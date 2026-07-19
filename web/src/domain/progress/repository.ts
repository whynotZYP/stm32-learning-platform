import type { LearnerState } from './types';

export interface ProgressRepository {
  load(): Promise<LearnerState>;
  save(state: LearnerState): Promise<void>;
  snapshot(): Promise<LearnerState>;
  replace(state: LearnerState): Promise<void>;
}
