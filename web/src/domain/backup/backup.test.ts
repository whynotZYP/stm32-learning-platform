import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../progress/defaultState';
import type { ProgressRepository } from '../progress/repository';
import type { LearnerState } from '../progress/types';
import { exportBackup, importBackup } from './backup';

const clone = <T,>(value: T): T => structuredClone(value);

function repository(initial = createDefaultState('2026-07-19T00:00:00.000Z')) {
  let active = clone(initial);
  const calls: string[] = [];
  const value: ProgressRepository & { calls: string[]; active: () => LearnerState; received?: LearnerState } = {
    calls,
    active: () => clone(active),
    async load() { calls.push('load'); return clone(active); },
    async save() {},
    async snapshot() { calls.push('snapshot'); return clone(active); },
    async replace(next) { calls.push('replace'); value.received = next; active = clone(next); },
  };
  return value;
}

describe('backup export and import', () => {
  it('exports a deterministic pretty versioned backup without mutating state', () => {
    const state = createDefaultState('2026-07-19T00:00:00.000Z');
    const backup = exportBackup(state, '2026-07-19T02:00:00.000Z');
    expect(backup).toBe(JSON.stringify({ format: 'stm32-learning-platform-backup', schemaVersion: 1, exportedAt: '2026-07-19T02:00:00.000Z', state }, null, 2));
    expect(state).toEqual(createDefaultState('2026-07-19T00:00:00.000Z'));
  });

  it('validates before snapshot, replaces a clone, then returns verified stored state', async () => {
    const current = createDefaultState('2026-07-19T00:00:00.000Z');
    const incoming = { ...createDefaultState('2026-07-19T01:00:00.000Z'), currentWeek: 4 };
    const repo = repository(current);
    const result = await importBackup(exportBackup(incoming, '2026-07-19T02:00:00.000Z'), repo);
    expect(repo.calls).toEqual(['snapshot', 'replace', 'load']);
    expect(result).toEqual(incoming);
    repo.received!.currentWeek = 24;
    expect(repo.active()).toEqual(incoming);
  });

  it.each([
    '{',
    JSON.stringify({ format: 'stm32-learning-platform-backup', schemaVersion: 2, exportedAt: '2026-07-19T02:00:00.000Z', state: createDefaultState() }),
    JSON.stringify({ format: 'wrong', schemaVersion: 1, exportedAt: '2026-07-19T02:00:00.000Z', state: createDefaultState() }),
    JSON.stringify({ format: 'stm32-learning-platform-backup', schemaVersion: 1, exportedAt: 'not-a-date', state: createDefaultState() }),
  ])('rejects invalid backup before any repository mutation', async (json) => {
    const repo = repository();
    const before = repo.active();
    await expect(importBackup(json, repo)).rejects.toThrow();
    expect(repo.calls).toEqual([]);
    expect(repo.active()).toEqual(before);
  });

  it('rejects duplicate evidence IDs through the one learner-state contract before snapshot', async () => {
    const state = createDefaultState('2026-07-19T01:00:00.000Z');
    state.evidence = [
      { id: 'same', learnerId: 'local', lessonId: 'w04', tagIds: ['gpio.output-mode'], kind: 'practical', status: 'manual-confirmed', score: 90, source: 'manual', createdAt: '2026-07-19T01:00:00.000Z', details: {} },
      { id: 'same', learnerId: 'local', lessonId: 'w05', tagIds: ['gpio.output-mode'], kind: 'practical', status: 'manual-confirmed', score: 90, source: 'manual', createdAt: '2026-07-19T01:00:00.000Z', details: {} },
    ];
    const repo = repository();
    const duplicateBackup = JSON.stringify({ format: 'stm32-learning-platform-backup', schemaVersion: 1, exportedAt: '2026-07-19T02:00:00.000Z', state });
    await expect(importBackup(duplicateBackup, repo)).rejects.toThrow();
    expect(repo.calls).toEqual([]);
  });

  it('does not replace active state when storage replacement rejects', async () => {
    const active = createDefaultState('2026-07-19T00:00:00.000Z');
    const incoming = { ...createDefaultState('2026-07-19T01:00:00.000Z'), currentWeek: 7 };
    const repo: ProgressRepository = { load: async () => clone(active), save: async () => undefined, snapshot: async () => clone(active), replace: async () => { throw new Error('offline'); } };
    await expect(importBackup(exportBackup(incoming), repo)).rejects.toThrow('offline');
    expect(await repo.load()).toEqual(active);
  });
});
