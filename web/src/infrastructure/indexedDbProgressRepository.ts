import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { createDefaultState } from '../domain/progress/defaultState';
import { migrateLearnerState } from '../domain/progress/migrateState';
import type { ProgressRepository } from '../domain/progress/repository';
import { LearnerStateSchema } from '../domain/progress/schemas';

interface LearningDb extends DBSchema {
  state: { key: 'active' | 'snapshot' | 'incoming'; value: unknown };
}

const clone = <T>(value: T): T => structuredClone(value);
const verify = (state: unknown) => migrateLearnerState(clone(state));

export function createIndexedDbProgressRepository(dbName = 'stm32-learning-platform'): ProgressRepository {
  let database: Promise<IDBPDatabase<LearningDb>> | undefined;

  function getDatabase() {
    if (database) return database;

    const opening = openDB<LearningDb>(dbName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
      },
      blocking(_, __, event) {
        (event.target as IDBDatabase).close();
        database = undefined;
      },
    });
    database = opening;
    void opening.catch(() => {
      if (database === opening) database = undefined;
    });
    return opening;
  }

  return {
    async load() {
      const db = await getDatabase();
      const state = await db.get('state', 'active');
      if (state !== undefined) return clone(verify(state));

      const initial = verify(createDefaultState());
      await db.put('state', initial, 'active');
      return clone(initial);
    },
    async save(state) {
      const verified = verify(state);
      const db = await getDatabase();
      await db.put('state', LearnerStateSchema.parse(verified), 'active');
    },
    async snapshot() {
      const db = await getDatabase();
      const state = await db.get('state', 'active');
      const active = verify(state === undefined ? createDefaultState() : state);
      await db.put('state', clone(active), 'snapshot');
      return clone(active);
    },
    async replace(state) {
      const verified = verify(state);
      const db = await getDatabase();
      const transaction = db.transaction('state', 'readwrite');
      await transaction.store.put(clone(verified), 'incoming');
      await transaction.store.put(clone(verified), 'active');
      await transaction.store.delete('incoming');
      await transaction.done;
    },
  };
}
