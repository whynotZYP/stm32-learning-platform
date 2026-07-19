import { StrictMode } from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultState } from '../domain/progress/defaultState';
import { exportBackup } from '../domain/backup/backup';
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
  it('rejects an empty evidence batch without saving or changing progress, then clears the error after a valid batch', async () => {
    const repository = createMemoryRepository();
    const { progress } = await renderProgress(repository);
    const before = structuredClone(progress().state);
    let rejected = true;
    await act(async () => { rejected = await progress().recordEvidenceBatch([]); });
    expect(rejected).toBe(false);
    expect(repository.saved).toHaveLength(0);
    expect(progress().state).toEqual(before);
    expect(progress().error).toBe('证据记录为空、重复或与已有记录冲突，未保存本次提交。');
    let recovered = false;
    await act(async () => { recovered = await progress().recordEvidenceBatch([evidence]); });
    expect(recovered).toBe(true);
    expect(repository.saved).toHaveLength(1);
    expect(progress().error).toBeUndefined();
  });

  it('rejects duplicate IDs within one evidence batch without saving', async () => {
    const repository = createMemoryRepository();
    const { progress } = await renderProgress(repository);
    let saved = true;
    await act(async () => { saved = await progress().recordEvidenceBatch([evidence, { ...evidence }]); });
    expect(saved).toBe(false);
    expect(repository.saved).toHaveLength(0);
    expect(progress().state.evidence).toEqual([]);
    expect(progress().error).toBe('证据记录为空、重复或与已有记录冲突，未保存本次提交。');
  });

  it('rejects an evidence ID that already exists in committed progress', async () => {
    const repository = createMemoryRepository();
    const { progress } = await renderProgress(repository);
    await act(async () => { await progress().recordEvidenceBatch([evidence]); });
    let saved = true;
    await act(async () => { saved = await progress().recordEvidenceBatch([{ ...evidence }]); });
    expect(saved).toBe(false);
    expect(repository.saved).toHaveLength(1);
    expect(progress().state.evidence).toEqual([evidence]);
  });

  it('serializes concurrent same-ID batches so only the first can save', async () => {
    const repository = createMemoryRepository();
    const { progress } = await renderProgress(repository);
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => { first = progress().recordEvidenceBatch([evidence]); second = progress().recordEvidenceBatch([{ ...evidence }]); });
    let results!: boolean[];
    await act(async () => { results = await Promise.all([first, second]); });
    expect(results).toEqual([true, false]);
    expect(repository.saved).toHaveLength(1);
    expect(progress().state.evidence).toEqual([evidence]);
  });

  it('persists an evidence batch atomically and isolates its caller records', async () => {
    const repository = createMemoryRepository();
    const second = { ...evidence, id: 'evidence-2', tagIds: ['foundation.binary'] };
    const records = [clone(evidence), second];
    const { progress } = await renderProgress(repository);
    let saved = false;
    await act(async () => { saved = await progress().recordEvidenceBatch(records); });
    records[0].tagIds[0] = 'mutated-by-caller';
    expect(saved).toBe(true);
    expect(repository.saved).toHaveLength(1);
    expect(repository.saved[0].evidence).toMatchObject([{ id: 'evidence-1', tagIds: ['gpio.output-mode'] }, { id: 'evidence-2', tagIds: ['foundation.binary'] }]);
    expect(progress().state.evidence).toHaveLength(2);
  });

  it('keeps a rejected evidence batch out of state and lets one retry save the full batch once', async () => {
    let calls = 0;
    const saved: LearnerState[] = [];
    const repository: ProgressRepository = {
      load: async () => createDefaultState(),
      save: async (next) => { calls += 1; if (calls === 1) throw new Error('disk full'); saved.push(clone(next)); },
      snapshot: async () => createDefaultState(), replace: async () => undefined,
    };
    const records = [evidence, { ...evidence, id: 'evidence-2' }];
    const { progress } = await renderProgress(repository);
    let first = true;
    await act(async () => { first = await progress().recordEvidenceBatch(records); });
    expect(first).toBe(false);
    expect(progress().state.evidence).toEqual([]);
    expect(progress().error).toBe('暂时无法保存学习进度，请稍后再试。');
    let second = false;
    await act(async () => { second = await progress().recordEvidenceBatch(records); });
    expect(second).toBe(true);
    expect(calls).toBe(2);
    expect(saved).toHaveLength(1);
    expect(saved[0].evidence.map((item) => item.id)).toEqual(['evidence-1', 'evidence-2']);
    expect(progress().error).toBeUndefined();
  });

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
    let evidenceOperation!: Promise<void>; let noteOperation!: Promise<boolean>;
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

  it('queues verified backup recovery through the existing repository boundary and retains state on validation failure', async () => {
    const repository = createMemoryRepository();
    const { progress } = await renderProgress(repository);
    await act(async () => { await progress().saveNote('before', '保留直到恢复'); });
    const incoming = { ...createDefaultState('2026-07-19T01:00:00.000Z'), currentWeek: 8, notes: { imported: '已恢复' } };
    repository.saved.length = 0;
    let restored: unknown;
    await act(async () => { restored = await progress().restoreBackup(exportBackup(incoming, '2026-07-19T02:00:00.000Z')); });
    expect(restored).toBe('restored');
    expect(progress().state).toEqual(incoming);
    const beforeInvalid = structuredClone(progress().state);
    await act(async () => { restored = await progress().restoreBackup('{'); });
    expect(restored).toBe('failed');
    expect(progress().state).toEqual(beforeInvalid);
    expect(progress().error).toBe('暂时无法恢复备份，原有学习进度未改变。');
  });

  it('uses the imported baseline after a committed but unverified restore', async () => {
    const initial = createDefaultState('2026-07-19T00:00:00.000Z');
    const incoming = { ...createDefaultState('2026-07-19T01:00:00.000Z'), currentWeek: 7, notes: { imported: 'keep' } };
    let loads = 0;
    const saved: LearnerState[] = [];
    const repository: ProgressRepository = {
      async load() { loads += 1; if (loads === 1) return clone(initial); throw new Error('verification unavailable'); },
      async save(next) { saved.push(clone(next)); }, snapshot: async () => clone(initial), replace: async () => undefined,
    };
    const { progress } = await renderProgress(repository);
    let result: unknown;
    await act(async () => { result = await progress().restoreBackup(exportBackup(incoming)); });
    expect(result).toBe('restored-unverified');
    expect(progress().state).toEqual(incoming);
    expect(progress().error).toContain('已恢复但暂时无法验证');
    await act(async () => { await progress().saveNote('after', 'uses imported state'); });
    expect(saved[0]).toMatchObject({ currentWeek: 7, notes: { imported: 'keep', after: 'uses imported state' } });
  });

  it('publishes the verified actual state when another window caused a restore conflict', async () => {
    const initial = createDefaultState('2026-07-19T00:00:00.000Z');
    const incoming = { ...createDefaultState('2026-07-19T01:00:00.000Z'), currentWeek: 7 };
    const actual = { ...createDefaultState('2026-07-19T01:00:00.000Z'), currentWeek: 8, notes: { otherWindow: 'newer' } };
    let loads = 0;
    const repository: ProgressRepository = {
      async load() { loads += 1; return clone(loads === 1 ? initial : actual); }, save: async () => undefined,
      snapshot: async () => clone(initial), replace: async () => undefined,
    };
    const { progress } = await renderProgress(repository);
    let result: unknown;
    await act(async () => { result = await progress().restoreBackup(exportBackup(incoming)); });
    expect(result).toBe('conflict');
    expect(progress().state).toEqual(actual);
    expect(progress().error).toContain('其他窗口');
  });

  it('keeps the old baseline after replace fails during restore', async () => {
    const initial = { ...createDefaultState('2026-07-19T00:00:00.000Z'), currentWeek: 3 };
    const repository: ProgressRepository = {
      load: async () => clone(initial), save: async () => undefined, snapshot: async () => clone(initial), replace: async () => { throw new Error('offline'); },
    };
    const { progress } = await renderProgress(repository);
    let result: unknown;
    await act(async () => { result = await progress().restoreBackup(exportBackup({ ...initial, currentWeek: 7 })); });
    expect(result).toBe('failed');
    expect(progress().state).toEqual(initial);
    expect(progress().error).toBe('暂时无法恢复备份，原有学习进度未改变。');
  });

  it('treats a replace rejection as restored when the follow-up load proves the imported state committed', async () => {
    const initial = createDefaultState('2026-07-19T00:00:00.000Z');
    const incoming = { ...createDefaultState('2026-07-19T01:00:00.000Z'), currentWeek: 12, notes: { imported: 'keep' } };
    let active = clone(initial);
    const saved: LearnerState[] = [];
    const repository: ProgressRepository = {
      load: async () => clone(active), save: async (next) => { saved.push(clone(next)); }, snapshot: async () => clone(initial),
      replace: async (next) => { active = clone(next); throw new Error('late write error'); },
    };
    const { progress } = await renderProgress(repository);
    let result: unknown;
    await act(async () => { result = await progress().restoreBackup(exportBackup(incoming)); });
    expect(result).toBe('restored');
    expect(progress().state).toEqual(incoming);
    await act(async () => { await progress().saveNote('after', 'keeps imported'); });
    expect(saved[0]).toMatchObject({ currentWeek: 12, notes: { imported: 'keep', after: 'keeps imported' } });
  });

  it('uses the imported baseline when a rejected replace cannot be followed by a verified load', async () => {
    const initial = createDefaultState('2026-07-19T00:00:00.000Z');
    const incoming = { ...createDefaultState('2026-07-19T01:00:00.000Z'), currentWeek: 13, notes: { imported: 'keep' } };
    let loads = 0;
    const saved: LearnerState[] = [];
    const repository: ProgressRepository = {
      load: async () => { loads += 1; if (loads === 1) return clone(initial); throw new Error('unavailable'); },
      save: async (next) => { saved.push(clone(next)); }, snapshot: async () => clone(initial), replace: async () => { throw new Error('late write error'); },
    };
    const { progress } = await renderProgress(repository);
    let result: unknown;
    await act(async () => { result = await progress().restoreBackup(exportBackup(incoming)); });
    expect(result).toBe('restore-unknown');
    expect(progress().state).toEqual(incoming);
    expect(progress().error).toContain('恢复结果暂时无法确认');
    await act(async () => { await progress().saveNote('after', 'keeps conservative baseline'); });
    expect(saved[0]).toMatchObject({ currentWeek: 13, notes: { imported: 'keep', after: 'keeps conservative baseline' } });
  });

  it('reports whether a note save actually reached local storage', async () => {
    let attempts = 0;
    const repository: ProgressRepository = {
      load: async () => createDefaultState(),
      save: async () => { attempts += 1; if (attempts === 1) throw new Error('disk full'); },
      snapshot: async () => createDefaultState(), replace: async () => undefined,
    };
    const { progress } = await renderProgress(repository);
    let first = true;
    let second = false;
    await act(async () => { first = await progress().saveNote('w01-foundations', 'first'); });
    await act(async () => { second = await progress().saveNote('w01-foundations', 'second'); });
    expect(first).toBe(false);
    expect(second).toBe(true);
    expect(progress().state.notes).toEqual({ 'w01-foundations': 'second' });
  });
});
