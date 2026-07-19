import { z } from 'zod';
import type { ProgressRepository } from '../progress/repository';
import { LearnerStateSchema } from '../progress/schemas';
import type { LearnerState } from '../progress/types';

const clone = <T,>(value: T): T => structuredClone(value);

export const BackupSchema = z.object({
  format: z.literal('stm32-learning-platform-backup'),
  schemaVersion: z.literal(1),
  exportedAt: z.string().datetime(),
  state: LearnerStateSchema,
}).strict();

export function exportBackup(state: LearnerState, now = new Date().toISOString()): string {
  const backup = BackupSchema.parse({
    format: 'stm32-learning-platform-backup',
    schemaVersion: 1,
    exportedAt: now,
    state: LearnerStateSchema.parse(clone(state)),
  });
  return JSON.stringify(clone(backup), null, 2);
}

export async function importBackup(json: string, repository: ProgressRepository): Promise<LearnerState> {
  const parsed = BackupSchema.parse(JSON.parse(json));
  const incoming = clone(parsed.state);
  await repository.snapshot();
  await repository.replace(clone(incoming));
  return clone(LearnerStateSchema.parse(clone(await repository.load())));
}
