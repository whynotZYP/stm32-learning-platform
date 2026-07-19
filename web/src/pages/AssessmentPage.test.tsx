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
    render(<ProgressProvider repository={store}><RouterProvider router={router} /></ProgressProvider>);
    expect(await screen.findAllByRole('group')).toHaveLength(4);
    for (const input of screen.getAllByLabelText(/得分（满分/)) fireEvent.change(input, { target: { value: '10' } });
    for (const input of screen.getAllByLabelText('你的回答')) fireEvent.change(input, { target: { value: '已完成回答' } });
    fireEvent.click(screen.getByRole('button', { name: '提交诊断' }));
    await waitFor(() => expect(store.saved.at(-1)?.evidence).toHaveLength(4));
    expect(await screen.findByText('诊断记录已保存。')).toBeInTheDocument();
  });

  it('shows a plain-Chinese page for an unknown assessment', async () => {
    const router = createMemoryRouter([{ path: '/assessment/:assessmentId', element: <AssessmentPage /> }], { initialEntries: ['/assessment/nope'] });
    render(<ProgressProvider repository={repository()}><RouterProvider router={router} /></ProgressProvider>);
    expect(await screen.findByRole('heading', { name: '没有找到这份测验' })).toBeInTheDocument();
  });
});
