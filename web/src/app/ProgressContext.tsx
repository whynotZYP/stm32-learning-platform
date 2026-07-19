import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createDefaultState } from '../domain/progress/defaultState';
import type { ProgressRepository } from '../domain/progress/repository';
import type { EvidenceRecord, LearnerState } from '../domain/progress/types';

const clone = <T,>(value: T): T => structuredClone(value);

export interface ProgressActions {
  recordEvidence(record: EvidenceRecord): Promise<void>;
  recordEvidenceBatch(records: EvidenceRecord[]): Promise<boolean>;
  saveNote(lessonId: string, markdown: string): Promise<void>;
  setCurrentWeek(week: number): Promise<void>;
  replaceState(state: LearnerState): Promise<void>;
}

export interface ProgressContextValue extends ProgressActions { state: LearnerState; loading: boolean; error: string | undefined; }

const ProgressContext = createContext<ProgressContextValue | undefined>(undefined);

export function ProgressProvider({ repository, children }: { repository: ProgressRepository; children: ReactNode }) {
  const repositoryRef = useRef(repository);
  if (repositoryRef.current !== repository) throw new Error('ProgressProvider 的 repository 在挂载后不能更换。');
  const boundRepository = repositoryRef.current;
  const stateRef = useRef<LearnerState | null>(null);
  if (!stateRef.current) stateRef.current = clone(createDefaultState());
  const [state, setState] = useState<LearnerState>(() => clone(stateRef.current!));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const mountedRef = useRef(false);
  const startedRef = useRef(false);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const initialReadyRef = useRef<Promise<void> | null>(null);
  const resolveInitialRef = useRef<(() => void) | null>(null);
  if (!initialReadyRef.current) initialReadyRef.current = new Promise<void>((resolve) => { resolveInitialRef.current = resolve; });

  const publish = useCallback((next: LearnerState) => {
    stateRef.current = clone(next);
    if (mountedRef.current) setState(clone(stateRef.current!));
  }, []);
  const showError = useCallback((message: string) => { if (mountedRef.current) setError(message); }, []);
  const clearError = useCallback(() => { if (mountedRef.current) setError(undefined); }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!startedRef.current) {
      startedRef.current = true;
      void (async () => {
        try {
          publish(clone(await boundRepository.load()));
          clearError();
        } catch {
          showError('暂时无法读取本机学习进度，请刷新页面后重试。');
        } finally {
          if (mountedRef.current) setLoading(false);
          resolveInitialRef.current?.();
        }
      })();
    }
    return () => { mountedRef.current = false; };
  }, [boundRepository, publish, clearError, showError]);

  const enqueue = useCallback(<T,>(operation: () => Promise<T>, fallback: T): Promise<T> => initialReadyRef.current!.then(() => {
    const task = queueRef.current.then(operation, operation).catch(() => {
      showError('暂时无法保存学习进度，请稍后再试。');
      return fallback;
    });
    queueRef.current = task.then(() => undefined);
    return task;
  }), [showError]);

  const save = useCallback(async (next: LearnerState) => {
    const committed = clone(next);
    try {
      await boundRepository.save(clone(committed));
      publish(committed);
      clearError();
      return true;
    } catch {
      showError('暂时无法保存学习进度，请稍后再试。');
      return false;
    }
  }, [boundRepository, publish, clearError, showError]);

  const recordEvidenceBatch = useCallback((records: EvidenceRecord[]) => {
    const incoming = records.map((record) => clone(record));
    return enqueue(async () => save({ ...clone(stateRef.current!), evidence: [...stateRef.current!.evidence, ...incoming], updatedAt: new Date().toISOString() }), false);
  }, [enqueue, save]);
  const recordEvidence = useCallback(async (record: EvidenceRecord) => { await recordEvidenceBatch([record]); }, [recordEvidenceBatch]);
  const saveNote = useCallback((lessonId: string, markdown: string) => enqueue(async () => { await save({ ...clone(stateRef.current!), notes: { ...stateRef.current!.notes, [lessonId]: markdown }, updatedAt: new Date().toISOString() }); }, undefined), [enqueue, save]);
  const setCurrentWeek = useCallback((week: number) => enqueue(async () => {
    if (!Number.isInteger(week) || week < 1 || week > 24) { showError('周编号必须在 1 到 24 之间。'); return; }
    await save({ ...clone(stateRef.current!), currentWeek: week, updatedAt: new Date().toISOString() });
  }, undefined), [enqueue, save, showError]);
  const replaceState = useCallback((next: LearnerState) => {
    const incoming = clone(next);
    return enqueue(async () => {
      try {
        await boundRepository.replace(clone(incoming));
        publish(incoming);
        try {
          publish(clone(await boundRepository.load()));
          clearError();
        } catch {
          showError('学习进度已保存，但暂时无法重新读取验证，请刷新页面后确认。');
        }
      } catch {
        showError('暂时无法替换学习进度，请刷新页面后重试。');
      }
    }, undefined);
  }, [enqueue, boundRepository, publish, clearError, showError]);

  const value = useMemo<ProgressContextValue>(() => ({ state, loading, error, recordEvidence, recordEvidenceBatch, saveNote, setCurrentWeek, replaceState }), [state, loading, error, recordEvidence, recordEvidenceBatch, saveNote, setCurrentWeek, replaceState]);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const value = useContext(ProgressContext);
  if (!value) throw new Error('ProgressProvider 未挂载');
  return value;
}
