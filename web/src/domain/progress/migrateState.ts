import { z } from 'zod';
import { createDefaultState } from './defaultState';
import { LearnerStateSchema } from './schemas';
import type { LearnerState } from './types';

const PrototypeStateSchema = z.object({
  schemaVersion: z.undefined().optional(),
  currentWeek: z.number().int().min(1).max(24).optional(),
  notes: z.record(z.string(), z.string()).optional(),
  updatedAt: z.string().datetime().optional(),
});

export function migrateLearnerState(input: unknown, now = new Date().toISOString()): LearnerState {
  const current = LearnerStateSchema.safeParse(input);
  if (current.success) return current.data;

  const prototype = PrototypeStateSchema.safeParse(input);
  if (prototype.success) {
    return {
      ...createDefaultState(prototype.data.updatedAt ?? now),
      currentWeek: prototype.data.currentWeek ?? 1,
      notes: prototype.data.notes ?? {},
    };
  }

  throw new Error('不支持或已损坏的进度数据版本');
}
