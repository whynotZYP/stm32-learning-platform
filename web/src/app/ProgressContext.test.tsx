import { StrictMode } from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultState } from '../domain/progress/defaultState';
import type { ProgressRepository } from '../domain/progress/repository';
import type { EvidenceRecord, LearnerState } from '../domain/progress/types';
import { ProgressProvider, useProgress, type ProgressContextValue } from './ProgressContext';

afterEach(cleanup);

const evidence: EvidenceRecord = { id: 'evidence-1', learnerId: 'local', lessonId: 'w04-gpio-output', tagIds: ['gpio.output-mode'], kind: 'practical', status: 'manual-confirmed', score: 100, source: 'manual', createdAt: '2026-07-19T00:00:00.000Z', details: { pin: 'PA0' } };
const clone = <T,>(value: T): T => structuredClone(value);

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

function createMemoryRepository(initial = createDefaultState('2026-07-19T00:00:00.000Z')): ProgressRepository & { saved: LearnerState[] } {
  let state = clone(initial);
  const saved: LearnerState[] = [];
  return {
    saved,
    async load() { return clone(state); },
    async save(next) { state = clone(next); saved.push(clone(next)); },
    async snapshot() { return clone(state); },
    async replace(next) { state = clone(next); },
  };
}

async function renderProgress(repository: ProgressRepository) {
  let current: ProgressContextValue | undefined;
  const view = render(<ProgressProvider repository={repository}><Probe onChange={(value) => { current = value; }} /></ProgressProvider>);
  await waitFor(() => expect(current?.loading).toBe(false));
  return { ...view, progress: () => current! };
}

function Probe({ onChange }: { onChange: (value: ProgressContextValue) => void }) {
  onChange(useProgress());
  return null;
}

describe('ProgressProvider', () => {
  it('waits for the initial load before deriving an early action', async () => {
    const loading = deferred<LearnerState>();
    const saved: LearnerState[] = [];
    const repository: ProgressRepository = { load: async () => loading.promise, save: async (next) => { saved.push(clone(next)); }, snapshot: async () => createDefaultState(), replace: async () => undefined };
    let current: ProgressContextValue | undefined;
    render(<ProgressProvider repository={repository}><Probe onChange={(value) => { current = value; }} /></ProgressProvider>);
    const operation = current!.recordEvidence(evidence);
    expect(saved).toHaveLength(0);
    await act(async () => { loading.resolve({ ...createDefaultState(), currentWeek: 3 }); await operation; });
    expect(saved[0]).toMatchObject({ currentWeek: 3, evidence: [evidence] });
  });

  it('records evidence in the repository and updates its consumer', async () => {
    const repository = createMemoryRepository();
    const { progress } = await renderProgress(repository);
    await act(async () => { await progress().recordEvidence(evidence); });
    expect(progress().state.evidence).toEqual([evidence]);
    expect(repository.saved[0].evidence).toEqual([evidence]);
  });

  it('saves notes, current week, and replacement state through the same boundary', async () => {
    const repository = createMemoryRepository();
    const { progress } = await renderProgress(repository);
    await act(async () => { await progress().saveNote('w04', 'GPIO'); });
    await act(async () => { await progress().setCurrentWeek(4); });
    const replacement = { ...createDefaultState('2026-07-19T01:00:00.000Z'), currentWeek: 6 };
    await act(async () => { await progress().replaceState(replacement); });
    expect(progress().state).toMatchObject({ currentWeek: 6, notes: {} });
    expect(repository.saved).toHaveLength(2);
  });

  it('serializes concurrent writes from the latest committed state', async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const saved: LearnerState[] = [];
    const repository: ProgressRepository = {
      load: async () => createDefaultState(),
      save: async (next) => { saved.push(clone(next)); return saved.length === 1 ? first.promise : second.promise; },
      snapshot: async () => createDefaultState(), replace: async () => undefined,
    };
    const { progress } = await renderProgress(repository);
    let evidenceOperation!: Promise<void>; let noteOperation!: Promise<void>;
    act(() => { evidenceOperation = progress().recordEvidence(evidence); noteOperation = progress().saveNote('w04', 'GPIO'); });
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].evidence).toHaveLength(1);
    await act(async () => { first.resolve(); });
    await waitFor(() => expect(saved).toHaveLength(2));
    expect(saved[1]).toMatchObject({ notes: { w04: 'GPIO' }, evidence: [evidence] });
    await act(async () => { second.resolve(); await Promise.all([evidenceOperation, noteOperation]); });
  });

  it('recovers the write queue after a rejected save and clears the error after the next success', async () => {
    let calls = 0;
    const repository: ProgressRepository = {
      load: async () => createDefaultState(),
      save: async () => { calls += 1; if (calls === 1) throw new Error('disk full'); },
      snapshot: async () => createDefaultState(), replace: async () => undefined,
    };
    const { progress } = await renderProgress(repository);
    await act(async () => { await progress().recordEvidence(evidence); });
    expect(progress().error).toBe('暂时无法保存学习进度，请稍后再试。');
    await act(async () => { await progress().setCurrentWeek(2); });
    expect(progress().state).toMatchObject({ currentWeek: 2, evidence: [] });
    expect(progress().error).toBeUndefined();
  });

  it('isolates loaded, action, repository, and replacement references', async () => {
    const loaded = createDefaultState();
    const verified = { ...createDefaultState(), currentWeek: 5 };
    const repository: ProgressRepository = {
      load: async () => clone(verified),
      save: async (next) => { next.evidence[0].tagIds[0] = 'mutated-by-repository'; },
      snapshot: async () => createDefaultState(),
      replace: async (next) => { next.currentWeek = 24; },
    };
    const { progress } = await renderProgress({ ...repository, load: async () => loaded });
    loaded.currentWeek = 24;
    const input = clone(evidence);
    await act(async () => { await progress().recordEvidence(input); });
    input.tagIds[0] = 'mutated-by-caller'; input.details.pin = 'PB0';
    expect(progress().state.evidence[0]).toMatchObject({ tagIds: ['gpio.output-mode'], details: { pin: 'PA0' } });
    const replacement = createDefaultState();
    const replacementRepository = { ...repository, load: async () => verified };
    const second = await renderProgress(replacementRepository);
    await act(async () => { await second.progress().replaceState(replacement); });
    replacement.currentWeek = 24; verified.currentWeek = 24;
    expect(second.progress().state.currentWeek).toBe(5);
  });

  it('does not update React state after an unmounted deferred write completes', async () => {
    const saving = deferred<void>();
    const repository: ProgressRepository = { load: async () => createDefaultState(), save: async () => saving.promise, snapshot: async () => createDefaultState(), replace: async () => undefined };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { progress, unmount } = await renderProgress(repository);
    const operation = progress().recordEvidence(evidence);
    unmount();
    await act(async () => { saving.resolve(); await operation; });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('explains a failed initial local load without rejecting a consumer action', async () => {
    const repository: ProgressRepository = { load: async () => { throw new Error('unavailable'); }, save: async () => undefined, snapshot: async () => createDefaultState(), replace: async () => undefined };
    const { progress } = await renderProgress(repository);
    expect(progress().error).toBe('暂时无法读取本机学习进度，请刷新页面后重试。');
  });

  it('keeps a successful replacement as the write baseline when verification load fails', async () => {
    let loads = 0;
    const saved: LearnerState[] = [];
    const replacement = { ...createDefaultState(), currentWeek: 6, notes: { imported: 'keep me' } };
    const repository: ProgressRepository = {
      load: async () => { loads += 1; if (loads === 1) return createDefaultState(); throw new Error('verification unavailable'); },
      replace: async () => undefined,
      save: async (next) => { saved.push(clone(next)); },
      snapshot: async () => createDefaultState(),
    };
    const { progress } = await renderProgress(repository);
    await act(async () => { await progress().replaceState(replacement); });
    expect(progress().state).toMatchObject(replacement);
    expect(progress().error).toBe('学习进度已保存，但暂时无法重新读取验证，请刷新页面后确认。');
    await act(async () => { await progress().saveNote('after', 'still queued'); await progress().setCurrentWeek(7); });
    expect(saved.at(-1)).toMatchObject({ currentWeek: 7, notes: { imported: 'keep me', after: 'still queued' } });
    expect(progress().error).toBeUndefined();
  });

  it('queues invalid week feedback behind earlier writes and clears it after a later success', async () => {
    const saving = deferred<void>();
    const repository: ProgressRepository = { load: async () => createDefaultState(), save: async () => saving.promise, snapshot: async () => createDefaultState(), replace: async () => undefined };
    const { progress } = await renderProgress(repository);
    const first = progress().saveNote('w04', 'GPIO');
    const invalid = progress().setCurrentWeek(25);
    expect(progress().error).toBeUndefined();
    await act(async () => { saving.resolve(); await Promise.all([first, invalid]); });
    expect(progress().error).toBe('周编号必须在 1 到 24 之间。');
    await act(async () => { await progress().recordEvidence(evidence); });
    expect(progress().error).toBeUndefined();
  });

  it('rejects repository identity changes without using the new repository', async () => {
    const first = createMemoryRepository();
    const second = createMemoryRepository();
    const secondLoad = vi.spyOn(second, 'load');
    let current: ProgressContextValue | undefined;
    const view = render(<ProgressProvider repository={first}><Probe onChange={(value) => { current = value; }} /></ProgressProvider>);
    await waitFor(() => expect(current?.loading).toBe(false));
    expect(() => view.rerender(<ProgressProvider repository={second}><Probe onChange={(value) => { current = value; }} /></ProgressProvider>)).toThrow('ProgressProvider 的 repository 在挂载后不能更换。');
    expect(secondLoad).not.toHaveBeenCalled();
    expect(second.saved).toHaveLength(0);
  });

  it('loads only once under StrictMode', async () => {
    const repository = createMemoryRepository();
    const load = vi.spyOn(repository, 'load');
    render(<StrictMode><ProgressProvider repository={repository}><Probe onChange={() => undefined} /></ProgressProvider></StrictMode>);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  });
});
