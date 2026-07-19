import { describe, expect, it } from 'vitest';
import { migrateLearnerState } from './migrateState';

describe('migrateLearnerState', () => {
  it('migrates a prototype record to version 1 while retaining its progress', () => {
    const state = migrateLearnerState({
      currentWeek: 4,
      notes: { w04: 'GPIO output reviewed' },
      updatedAt: '2026-07-19T00:00:00.000Z',
    });

    expect(state).toMatchObject({
      schemaVersion: 1,
      learnerId: 'local',
      currentWeek: 4,
      notes: { w04: 'GPIO output reviewed' },
    });
  });

  it('rejects an unsupported schema version', () => {
    expect(() => migrateLearnerState({ schemaVersion: 2 })).toThrow('不支持或已损坏的进度数据版本');
  });
});
