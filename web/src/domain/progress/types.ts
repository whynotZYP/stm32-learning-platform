export type EvidenceKind = 'concept' | 'configuration' | 'practical' | 'reflection';
export type EvidenceStatus = 'auto-pass' | 'manual-confirmed' | 'pending' | 'failed';
export type EvidenceSource = 'assessment' | 'device' | 'manual' | 'note';
export type MasteryBand = 'mastered' | 'review' | 'remediate' | 'relearn';

export interface EvidenceRecord {
  id: string;
  learnerId: 'local';
  lessonId: string;
  tagIds: string[];
  kind: EvidenceKind;
  status: EvidenceStatus;
  score: number;
  source: EvidenceSource;
  createdAt: string;
  details: Record<string, string | number | boolean>;
}

export interface LessonProgress {
  lessonId: string;
  status: 'not-started' | 'in-progress' | 'completed';
  rubricScores: Partial<Record<EvidenceKind, number>>;
  completedAt?: string;
}

export interface RemediationItem {
  id: string;
  tagId: string;
  reason: string;
  action: 'concept-breakdown' | 'signal-to-register' | 'minimal-lab' | 'shared-protocol-foundation' | 'prerequisite-reset';
  status: 'queued' | 'in-progress' | 'completed';
}

export interface LearnerState {
  schemaVersion: 1;
  learnerId: 'local';
  currentWeek: number;
  lessonProgress: Record<string, LessonProgress>;
  evidence: EvidenceRecord[];
  remediationQueue: RemediationItem[];
  notes: Record<string, string>;
  completedPhaseIds: number[];
  updatedAt: string;
}

export interface BackupEnvelope {
  format: 'stm32-learning-platform-backup';
  schemaVersion: 1;
  exportedAt: string;
  state: LearnerState;
}
