import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ProgressProvider } from '../app/ProgressContext';
import { createDefaultState } from '../domain/progress/defaultState';
import type { ProgressRepository } from '../domain/progress/repository';
import { AssessmentPage } from './AssessmentPage';

afterEach(cleanup);

function repository(): ProgressRepository & { saved: ReturnType<typeof createDefaultState>[] } {
  const saved: ReturnType<typeof createDefaultState>[] = [];
  const state = createDefaultState('2026-07-01T00:00:00.000Z');
  return { saved, async load() { return structuredClone(state); }, async save(next) { saved.push(structuredClone(next)); }, async snapshot() { return structuredClone(state); }, async replace() { return undefined; } };
}

describe('AssessmentPage', () => {
  it('renders all four fieldsets and records every evidence item with one submission', async () => {
    const store = repository();
    const router = createMemoryRouter([{ path: '/assessment/:assessmentId', element: <AssessmentPage /> }], { initialEntries: ['/assessment/entry-diagnostic'] });
    render(<StrictMode><ProgressProvider repository={store}><RouterProvider router={router} /></ProgressProvider></StrictMode>);
    expect(await screen.findAllByRole('group')).toHaveLength(4);
    for (const input of screen.getAllByLabelText(/得分（满分/)) fireEvent.change(input, { target: { value: '10' } });
    for (const input of screen.getAllByLabelText('你的回答')) fireEvent.change(input, { target: { value: '已完成回答' } });
    fireEvent.click(screen.getByRole('button', { name: '提交诊断' }));
    await waitFor(() => expect(store.saved.at(-1)?.evidence).toHaveLength(4));
    expect(await screen.findByText('诊断记录已保存。')).toBeInTheDocument();
  });

  it('keeps the assessment retryable when its one atomic batch save fails', async () => {
    let attempts = 0;
    const saved: ReturnType<typeof createDefaultState>[] = [];
    const state = createDefaultState('2026-07-01T00:00:00.000Z');
    const store: ProgressRepository = {
      load: async () => structuredClone(state),
      save: async (next) => { attempts += 1; if (attempts === 1) throw new Error('disk full'); saved.push(structuredClone(next)); },
      snapshot: async () => structuredClone(state), replace: async () => undefined,
    };
    const router = createMemoryRouter([{ path: '/assessment/:assessmentId', element: <AssessmentPage /> }], { initialEntries: ['/assessment/entry-diagnostic'] });
    render(<StrictMode><ProgressProvider repository={store}><RouterProvider router={router} /></ProgressProvider></StrictMode>);
    await screen.findAllByRole('group');
    for (const input of screen.getAllByLabelText('你的回答')) fireEvent.change(input, { target: { value: '回答' } });
    const button = screen.getByRole('button', { name: '提交诊断' });
    fireEvent.click(button);
    expect(await screen.findByText('保存出现问题，诊断未被标记为完成，请检查后重试。')).toBeInTheDocument();
    expect(button).toBeEnabled();
    expect(saved).toHaveLength(0);
    expect(attempts).toBe(1);
    fireEvent.click(button);
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].evidence).toHaveLength(4);
    expect(attempts).toBe(2);
    expect(await screen.findByText('诊断记录已保存。')).toBeInTheDocument();
  });

  it('shows a plain-Chinese page for an unknown assessment', async () => {
    const router = createMemoryRouter([{ path: '/assessment/:assessmentId', element: <AssessmentPage /> }], { initialEntries: ['/assessment/nope'] });
    render(<ProgressProvider repository={repository()}><RouterProvider router={router} /></ProgressProvider>);
    expect(await screen.findByRole('heading', { name: '没有找到这份测验' })).toBeInTheDocument();
  });

  it('lists the exact saved evidence with its source and status', async () => {
    const store = repository();
    const router = createMemoryRouter([{ path: '/assessment/:assessmentId', element: <AssessmentPage /> }], { initialEntries: ['/assessment/entry-diagnostic'] });
    render(<ProgressProvider repository={store}><RouterProvider router={router} /></ProgressProvider>);
    await screen.findAllByRole('group');
    for (const input of screen.getAllByLabelText('你的回答')) fireEvent.change(input, { target: { value: '已回答' } });
    fireEvent.click(screen.getByRole('button', { name: '提交诊断' }));
    const saved = await screen.findByRole('status');
    expect(saved).toHaveTextContent('来源：测验');
    expect(saved).toHaveTextContent('状态：人工确认');
    expect(screen.getByRole('list', { name: '本次保存的证据' })).toHaveTextContent('assessment-entry-diagnostic');
  });
});
