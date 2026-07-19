import 'fake-indexeddb/auto';
import { deleteDB, openDB, type DBSchema } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultState } from '../domain/progress/defaultState';
import { createIndexedDbProgressRepository } from './indexedDbProgressRepository';

const dbName = 'stm32-learning-platform-test';
const invalidStateError = '不支持或已损坏的进度数据版本';

interface RawLearningDb extends DBSchema {
  state: { key: 'active' | 'snapshot' | 'incoming'; value: unknown };
}

async function writeRawState(key: 'active' | 'snapshot' | 'incoming', value: unknown) {
  const database = await openDB<RawLearningDb>(dbName, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
    },
  });

  try {
    await database.put('state', value, key);
  } finally {
    database.close();
  }
}

async function readRawState(key: 'active' | 'snapshot' | 'incoming') {
  const database = await openDB<RawLearningDb>(dbName, 1);

  try {
    return await database.get('state', key);
  } finally {
    database.close();
  }
}

afterEach(async () => deleteDB(dbName));

describe('IndexedDB progress repository', () => {
  it('returns a versioned empty state on first use', async () => {
    const repository = createIndexedDbProgressRepository(dbName);

    const state = await repository.load();

    expect(state.schemaVersion).toBe(1);
    expect(state.currentWeek).toBe(1);
    expect(Date.parse(state.updatedAt)).not.toBeNaN();
  });

  it('persists the initial state for a new repository instance', async () => {
    const first = await createIndexedDbProgressRepository(dbName).load();

    const loaded = await createIndexedDbProgressRepository(dbName).load();

    expect(loaded.updatedAt).toBe(first.updatedAt);
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
    expect((await readRawState('snapshot'))).toMatchObject({ currentWeek: 6 });
  });

  it('rejects a raw version-2 active record', async () => {
    await writeRawState('active', { schemaVersion: 2 });

    await expect(createIndexedDbProgressRepository(dbName).load()).rejects.toThrow(invalidStateError);
  });

  it('rejects a null active record without overwriting it', async () => {
    await writeRawState('active', null);
    const repository = createIndexedDbProgressRepository(dbName);

    await expect(repository.load()).rejects.toThrow(invalidStateError);

    expect(await readRawState('active')).toBeNull();
  });

  it('rejects a null active record when creating a snapshot', async () => {
    await writeRawState('active', null);
    const repository = createIndexedDbProgressRepository(dbName);

    await expect(repository.snapshot()).rejects.toThrow(invalidStateError);

    expect(await readRawState('active')).toBeNull();
  });

  it('rejects invalid writes while retaining the existing active state', async () => {
    const repository = createIndexedDbProgressRepository(dbName);
    const state = { ...createDefaultState('2026-07-19T00:00:00.000Z'), currentWeek: 3 };
    await repository.save(state);

    await expect(repository.save({ ...state, currentWeek: 25 })).rejects.toThrow();
    await expect(repository.replace({ ...state, schemaVersion: 2 } as never)).rejects.toThrow(invalidStateError);
    await expect(repository.replace({ ...state, currentWeek: 25 })).rejects.toThrow(invalidStateError);

    expect((await repository.load()).currentWeek).toBe(3);
    expect(await readRawState('incoming')).toBeUndefined();
  });

  it('reopens its database after deletion', async () => {
    const repository = createIndexedDbProgressRepository(dbName);
    await repository.load();

    await deleteDB(dbName);

    expect((await repository.load()).currentWeek).toBe(1);
  });
});
