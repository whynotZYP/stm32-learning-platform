import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultState } from '../domain/progress/defaultState';
import { createIndexedDbProgressRepository } from './indexedDbProgressRepository';

const dbName = 'stm32-learning-platform-test';

afterEach(async () => deleteDB(dbName));

describe('IndexedDB progress repository', () => {
  it('returns a versioned empty state on first use', async () => {
    const repository = createIndexedDbProgressRepository(dbName);

    const state = await repository.load();

    expect(state.schemaVersion).toBe(1);
    expect(state.currentWeek).toBe(1);
    expect(Date.parse(state.updatedAt)).not.toBeNaN();
  });

  it('saves and replaces state without sharing mutable references', async () => {
    const repository = createIndexedDbProgressRepository(dbName);
    const state = createDefaultState('2026-07-19T00:00:00.000Z');
    state.currentWeek = 4;
    await repository.save(state);

    const loaded = await repository.load();
    loaded.currentWeek = 8;
    expect((await repository.load()).currentWeek).toBe(4);

    await repository.replace({ ...loaded, currentWeek: 8 });
    expect((await repository.load()).currentWeek).toBe(8);
  });

  it('returns an isolated snapshot of the active state', async () => {
    const repository = createIndexedDbProgressRepository(dbName);
    await repository.save({ ...createDefaultState('2026-07-19T00:00:00.000Z'), currentWeek: 6 });

    const snapshot = await repository.snapshot();
    snapshot.currentWeek = 9;

    expect((await repository.load()).currentWeek).toBe(6);
  });
});
