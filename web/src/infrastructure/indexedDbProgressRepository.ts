import { openDB, type DBSchema } from 'idb';
import { createDefaultState } from '../domain/progress/defaultState';
import { migrateLearnerState } from '../domain/progress/migrateState';
import type { ProgressRepository } from '../domain/progress/repository';
import { LearnerStateSchema } from '../domain/progress/schemas';

interface LearningDb extends DBSchema {
  state: { key: 'active' | 'snapshot' | 'incoming'; value: unknown };
}

const clone = <T>(value: T): T => structuredClone(value);

export function createIndexedDbProgressRepository(dbName = 'stm32-learning-platform'): ProgressRepository {
  const database = openDB<LearningDb>(dbName, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
    },
    blocking(_, __, event) {
      (event.target as IDBDatabase).close();
    },
  });

  return {
    async load() {
      const db = await database;
      const state = await db.get('state', 'active');
      if (state) return clone(migrateLearnerState(state));

      const initial = createDefaultState();
      await db.put('state', initial, 'active');
      return clone(initial);
    },
    async save(state) {
      const db = await database;
      await db.put('state', LearnerStateSchema.parse(clone(state)), 'active');
    },
    async snapshot() {
      const db = await database;
      const active = migrateLearnerState((await db.get('state', 'active')) ?? createDefaultState());
      await db.put('state', clone(active), 'snapshot');
      return clone(active);
    },
    async replace(state) {
      const db = await database;
      const transaction = db.transaction('state', 'readwrite');
      await transaction.store.put(clone(state), 'incoming');
      const verified = migrateLearnerState(await transaction.store.get('incoming'));
      await transaction.store.put(clone(verified), 'active');
      await transaction.store.delete('incoming');
      await transaction.done;
    },
  };
}
