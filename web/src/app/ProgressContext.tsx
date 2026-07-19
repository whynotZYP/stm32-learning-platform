import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createDefaultState } from '../domain/progress/defaultState';
import type { ProgressRepository } from '../domain/progress/repository';
import type { EvidenceRecord, LearnerState } from '../domain/progress/types';

export interface ProgressActions {
  recordEvidence(record: EvidenceRecord): Promise<void>;
  saveNote(lessonId: string, markdown: string): Promise<void>;
  setCurrentWeek(week: number): Promise<void>;
  replaceState(state: LearnerState): Promise<void>;
}

export interface ProgressContextValue extends ProgressActions {
  state: LearnerState;
  loading: boolean;
  error: string | undefined;
}

const ProgressContext = createContext<ProgressContextValue | undefined>(undefined);

export function ProgressProvider({ repository, children }: { repository: ProgressRepository; children: ReactNode }) {
  const [state, setState] = useState<LearnerState>(() => createDefaultState());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const stateRef = useRef(state);

  useEffect(() => {
    let active = true;
    void repository.load()
      .then((loaded) => {
        if (!active) return;
        stateRef.current = loaded;
        setState(loaded);
        setError(undefined);
      })
      .catch(() => {
        if (active) setError('暂时无法读取本机学习进度，请刷新页面后重试。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [repository]);

  const save = useCallback(async (next: LearnerState) => {
    await repository.save(next);
    stateRef.current = next;
    setState(next);
  }, [repository]);

  const recordEvidence = useCallback(async (record: EvidenceRecord) => {
    await save({ ...stateRef.current, evidence: [...stateRef.current.evidence, record], updatedAt: new Date().toISOString() });
  }, [save]);

  const saveNote = useCallback(async (lessonId: string, markdown: string) => {
    await save({ ...stateRef.current, notes: { ...stateRef.current.notes, [lessonId]: markdown }, updatedAt: new Date().toISOString() });
  }, [save]);

  const setCurrentWeek = useCallback(async (week: number) => {
    if (!Number.isInteger(week) || week < 1 || week > 24) throw new Error('周编号必须在 1 到 24 之间');
    await save({ ...stateRef.current, currentWeek: week, updatedAt: new Date().toISOString() });
  }, [save]);

  const replaceState = useCallback(async (next: LearnerState) => {
    await repository.replace(next);
    const verified = await repository.load();
    stateRef.current = verified;
    setState(verified);
  }, [repository]);

  const value = useMemo<ProgressContextValue>(
    () => ({ state, loading, error, recordEvidence, saveNote, setCurrentWeek, replaceState }),
    [state, loading, error, recordEvidence, saveNote, setCurrentWeek, replaceState],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const value = useContext(ProgressContext);
  if (!value) throw new Error('ProgressProvider 未挂载');
  return value;
}
