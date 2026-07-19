import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProgressProvider } from '../app/ProgressContext';
import { exportBackup } from '../domain/backup/backup';
import { createDefaultState } from '../domain/progress/defaultState';
import type { ProgressRepository } from '../domain/progress/repository';
import type { LearnerState } from '../domain/progress/types';
import { download, NotesSettingsPage } from './NotesSettingsPage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const clone = <T,>(value: T): T => structuredClone(value);

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function createRepository(initial = createDefaultState('2026-07-19T00:00:00.000Z')) {
  let active = clone(initial);
  const calls: string[] = [];
  const repository: ProgressRepository & { calls: string[]; active: () => LearnerState } = {
    calls, active: () => clone(active),
    async load() { calls.push('load'); return clone(active); },
    async save(next) { calls.push('save'); active = clone(next); },
    async snapshot() { calls.push('snapshot'); return clone(active); },
    async replace(next) { calls.push('replace'); active = clone(next); },
  };
  return repository;
}

function renderPage(repository: ProgressRepository = createRepository(), strict = false) {
  const page = <ProgressProvider repository={repository}><NotesSettingsPage /></ProgressProvider>;
  return { repository, ...render(strict ? <StrictMode>{page}</StrictMode> : page) };
}

describe('NotesSettingsPage', () => {
  it('downloads local Markdown and full progress, then revokes each temporary URL', async () => {
    const create = vi.fn(() => 'blob:download');
    const revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderPage();
    expect(await screen.findByRole('button', { name: '导出 Markdown' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '导出 Markdown' }));
    fireEvent.click(screen.getByRole('button', { name: '导出全部进度' }));
    expect(create).toHaveBeenCalledTimes(2);
    expect(click).toHaveBeenCalledTimes(2);
    expect(revoke).toHaveBeenCalledTimes(2);
  });

  it('revokes its temporary URL even when the browser click throws', () => {
    const create = vi.fn(() => 'blob:broken-download');
    const revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => download('内容', 'note.md', 'text/markdown;charset=utf-8')).toThrow('blocked');
    expect(revoke).toHaveBeenCalledWith('blob:broken-download');
  });

  it('validates the selected file, does nothing when recovery is cancelled, and immediately publishes a restored state', async () => {
    const repository = createRepository();
    renderPage(repository, true);
    const incoming = { ...createDefaultState('2026-07-19T01:00:00.000Z'), currentWeek: 7 };
    const file = new File([exportBackup(incoming, '2026-07-19T02:00:00.000Z')], 'progress.json', { type: 'application/json' });
    const input = await screen.findByLabelText('导入备份');
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    expect(await screen.findByRole('status')).toHaveTextContent('备份文件已验证');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: '恢复已选备份' }));
    expect(repository.calls).not.toContain('snapshot');
    fireEvent.click(screen.getByRole('button', { name: '恢复已选备份' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('备份已恢复'));
    expect(repository.calls).toContain('snapshot');
    expect(repository.calls).toContain('replace');
    expect(screen.getByText('当前导出：第 7 周')).toBeInTheDocument();
  });

  it('shows a plain-language alert for unreadable or invalid files and never changes progress', async () => {
    const repository = createRepository();
    renderPage(repository);
    const file = new File(['{'], 'broken.json', { type: 'application/json' });
    const input = await screen.findByLabelText('导入备份');
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    expect(await screen.findByRole('alert')).toHaveTextContent('备份文件无法读取或格式不正确，请选择本平台导出的备份文件。');
    expect(repository.calls).not.toContain('snapshot');
    expect(repository.active().currentWeek).toBe(1);
  });

  it('keeps the validated candidate available for retry after a storage error', async () => {
    let active = createDefaultState('2026-07-19T00:00:00.000Z');
    let replaces = 0;
    const repository: ProgressRepository = {
      async load() { return clone(active); },
      async save(next) { active = clone(next); },
      async snapshot() { return clone(active); },
      async replace(next) { replaces += 1; if (replaces === 1) throw new Error('storage unavailable'); active = clone(next); },
    };
    renderPage(repository, true);
    const incoming = { ...createDefaultState('2026-07-19T01:00:00.000Z'), currentWeek: 9 };
    const file = new File([exportBackup(incoming, '2026-07-19T02:00:00.000Z')], 'progress.json', { type: 'application/json' });
    const input = await screen.findByLabelText('导入备份');
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    await screen.findByRole('status');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '恢复已选备份' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('恢复备份时出现问题，原有学习进度未改变。');
    expect(screen.getByRole('button', { name: '恢复已选备份' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '恢复已选备份' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('备份已恢复'));
    expect(screen.getByText('当前导出：第 9 周')).toBeInTheDocument();
  });

  it('shows a committed-but-unverified warning without claiming the old progress was retained', async () => {
    const initial = createDefaultState('2026-07-19T00:00:00.000Z');
    const incoming = { ...createDefaultState('2026-07-19T01:00:00.000Z'), currentWeek: 10 };
    let loads = 0;
    const repository: ProgressRepository = {
      async load() { loads += 1; if (loads === 1) return clone(initial); throw new Error('verification unavailable'); },
      save: async () => undefined, snapshot: async () => clone(initial), replace: async () => undefined,
    };
    renderPage(repository, true);
    const input = await screen.findByLabelText('导入备份');
    const file = new File([exportBackup(incoming)], 'progress.json', { type: 'application/json' });
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    await screen.findByRole('status');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '恢复已选备份' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('已恢复但暂时无法验证');
    expect(screen.queryByRole('button', { name: '恢复已选备份' })).not.toBeInTheDocument();
    expect(screen.queryByText('原有学习进度未改变')).not.toBeInTheDocument();
    expect(screen.getByText('当前导出：第 10 周')).toBeInTheDocument();
  });

  it('shows a conflict warning and keeps a safe retry option with the verified current state', async () => {
    const initial = createDefaultState('2026-07-19T00:00:00.000Z');
    const incoming = { ...createDefaultState('2026-07-19T01:00:00.000Z'), currentWeek: 11 };
    const actual = { ...createDefaultState('2026-07-19T01:00:00.000Z'), currentWeek: 14, notes: { otherWindow: 'newer' } };
    let loads = 0;
    const repository: ProgressRepository = {
      async load() { loads += 1; return clone(loads === 1 ? initial : actual); },
      save: async () => undefined, snapshot: async () => clone(initial), replace: async () => undefined,
    };
    renderPage(repository, true);
    const input = await screen.findByLabelText('导入备份');
    await act(async () => { fireEvent.change(input, { target: { files: [new File([exportBackup(incoming)], 'progress.json')] } }); });
    await screen.findByRole('status');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '恢复已选备份' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('其他窗口');
    expect(screen.getByRole('button', { name: '恢复已选备份' })).toBeEnabled();
    expect(screen.getByText('当前导出：第 14 周')).toBeInTheDocument();
  });

  it('shows an unknown-commit warning without offering an immediate duplicate restore', async () => {
    const initial = createDefaultState('2026-07-19T00:00:00.000Z');
    const incoming = { ...createDefaultState('2026-07-19T01:00:00.000Z'), currentWeek: 15 };
    let loads = 0;
    const repository: ProgressRepository = {
      async load() { loads += 1; if (loads === 1) return clone(initial); throw new Error('unavailable'); },
      save: async () => undefined, snapshot: async () => clone(initial), replace: async () => { throw new Error('late write error'); },
    };
    renderPage(repository, true);
    const input = await screen.findByLabelText('导入备份');
    await act(async () => { fireEvent.change(input, { target: { files: [new File([exportBackup(incoming)], 'progress.json')] } }); });
    await screen.findByRole('status');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '恢复已选备份' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('恢复结果暂时无法确认，已以备份作为当前基线');
    expect(screen.queryByRole('button', { name: '恢复已选备份' })).not.toBeInTheDocument();
    expect(screen.queryByText('原有学习进度未改变')).not.toBeInTheDocument();
    expect(screen.getByText('当前导出：第 15 周')).toBeInTheDocument();
  });

  it('prevents duplicate restore work while a confirmation is already restoring', async () => {
    const replace = deferred<void>();
    let active = createDefaultState('2026-07-19T00:00:00.000Z');
    const snapshot = vi.fn(async () => clone(active));
    const replaceState = vi.fn(async (next: LearnerState) => { active = clone(next); await replace.promise; });
    const repository: ProgressRepository = { load: async () => clone(active), save: async () => undefined, snapshot, replace: replaceState };
    renderPage(repository, true);
    const input = await screen.findByLabelText('导入备份');
    const incoming = { ...createDefaultState('2026-07-19T01:00:00.000Z'), currentWeek: 11 };
    await act(async () => { fireEvent.change(input, { target: { files: [new File([exportBackup(incoming)], 'progress.json')] } }); });
    await screen.findByRole('status');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const button = screen.getByRole('button', { name: '恢复已选备份' });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(snapshot).toHaveBeenCalledTimes(1));
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(input).toBeDisabled();
    await act(async () => { replace.resolve(); });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('备份已恢复'));
  });

  it('keeps only the latest selected file when slower file reads resolve out of order', async () => {
    const repository = createRepository();
    renderPage(repository, true);
    const first = deferred<string>();
    const second = deferred<string>();
    const input = await screen.findByLabelText('导入备份');
    const backupA = exportBackup({ ...createDefaultState('2026-07-19T01:00:00.000Z'), currentWeek: 12 });
    const backupB = exportBackup({ ...createDefaultState('2026-07-19T01:00:00.000Z'), currentWeek: 13 });
    const fileA = { name: 'a.json', text: () => first.promise } as File;
    const fileB = { name: 'b.json', text: () => second.promise } as File;
    fireEvent.change(input, { target: { files: [fileA] } });
    fireEvent.change(input, { target: { files: [fileB] } });
    await act(async () => { second.resolve(backupB); });
    await screen.findByRole('status');
    await act(async () => { first.resolve(backupA); });
    vi.spyOn(window, 'confirm').mockImplementation((message) => { expect(message).toContain('b.json'); return true; });
    fireEvent.click(screen.getByRole('button', { name: '恢复已选备份' }));
    await waitFor(() => expect(screen.getByText('当前导出：第 13 周')).toBeInTheDocument());
    expect(repository.active().currentWeek).toBe(13);
  });
});
