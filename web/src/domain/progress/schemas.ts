import { z } from 'zod';

const EvidenceKindSchema = z.enum(['concept', 'configuration', 'practical', 'reflection']);
const EvidenceStatusSchema = z.enum(['auto-pass', 'manual-confirmed', 'pending', 'failed']);
const DetailValueSchema = z.union([z.string(), z.number().finite(), z.boolean()]);

export const EvidenceRecordSchema = z.object({
  id: z.string().min(1),
  learnerId: z.literal('local'),
  lessonId: z.string().min(1),
  tagIds: z.array(z.string().min(1)),
  kind: EvidenceKindSchema,
  status: EvidenceStatusSchema,
  score: z.number().min(0).max(100),
  source: z.enum(['assessment', 'device', 'manual', 'note']),
  createdAt: z.string().datetime(),
  details: z.record(z.string(), DetailValueSchema),
});

export const LessonProgressSchema = z.object({
  lessonId: z.string().min(1),
  status: z.enum(['not-started', 'in-progress', 'completed']),
  rubricScores: z.partialRecord(EvidenceKindSchema, z.number().min(0).max(100)),
  completedAt: z.string().datetime().optional(),
});

export const RemediationItemSchema = z.object({
  id: z.string().min(1),
  tagId: z.string().min(1),
  reason: z.string().min(1),
  action: z.enum(['concept-breakdown', 'signal-to-register', 'minimal-lab', 'shared-protocol-foundation', 'prerequisite-reset']),
  status: z.enum(['queued', 'in-progress', 'completed']),
});

export const LearnerStateSchema = z.object({
  schemaVersion: z.literal(1),
  learnerId: z.literal('local'),
  currentWeek: z.number().int().min(1).max(24),
  lessonProgress: z.record(z.string(), LessonProgressSchema),
  evidence: z.array(EvidenceRecordSchema),
  remediationQueue: z.array(RemediationItemSchema),
  notes: z.record(z.string(), z.string()),
  completedPhaseIds: z.array(z.number().int().min(1).max(6)),
  updatedAt: z.string().datetime(),
});
