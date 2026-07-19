import { z } from 'zod';
import type { ProgressRepository } from '../progress/repository';
import { LearnerStateSchema } from '../progress/schemas';
import type { LearnerState } from '../progress/types';

const clone = <T,>(value: T): T => structuredClone(value);

export type BackupCommittedKind = 'committed-unverified' | 'conflict';

export class BackupCommittedStateError extends Error {
  readonly kind: BackupCommittedKind;
  readonly state: LearnerState;

  constructor(kind: BackupCommittedKind, state: LearnerState) {
    super(kind === 'conflict' ? '备份恢复后检测到进度冲突' : '备份已恢复但暂时无法验证');
    this.name = 'BackupCommittedStateError';
    this.kind = kind;
    this.state = clone(state);
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical((value as Record<string, unknown>)[key])]));
  return value;
}

function semanticallyEqual(left: LearnerState, right: LearnerState) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

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
  try {
    const verified = clone(LearnerStateSchema.parse(clone(await repository.load())));
    if (!semanticallyEqual(incoming, verified)) throw new BackupCommittedStateError('conflict', verified);
    return verified;
  } catch (error) {
    if (error instanceof BackupCommittedStateError) throw error;
    throw new BackupCommittedStateError('committed-unverified', incoming);
  }
}
