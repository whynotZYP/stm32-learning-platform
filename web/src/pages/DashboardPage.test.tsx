import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ProgressProvider } from '../app/ProgressContext';
import { createDefaultState } from '../domain/progress/defaultState';
import type { ProgressRepository } from '../domain/progress/repository';
import type { EvidenceRecord } from '../domain/progress/types';
import { DashboardPage } from './DashboardPage';

afterEach(cleanup);

const evidence = (tagId: string): EvidenceRecord => ({ id: `e-${tagId}`, learnerId: 'local', lessonId: 'entry-diagnostic', tagIds: [tagId], kind: 'concept', status: 'auto-pass', score: 95, source: 'assessment', createdAt: '2026-07-01T00:00:00.000Z', details: {} });

describe('DashboardPage', () => {
  it('shows a diagnostic recommendation and only changes current week when it is accepted', async () => {
    const initial = { ...createDefaultState('2026-07-18T00:00:00.000Z'), evidence: ['foundation.electricity', 'foundation.binary', 'c.control-flow', 'c.memory'].map(evidence) };
    const saved: typeof initial[] = [];
    const repository: ProgressRepository = { load: async () => structuredClone(initial), save: async (state) => { saved.push(structuredClone(state)); }, snapshot: async () => structuredClone(initial), replace: async () => undefined };
    render(<MemoryRouter><ProgressProvider repository={repository}><DashboardPage /></ProgressProvider></MemoryRouter>);
    expect(await screen.findByText(/从工具链实操开始/)).toBeInTheDocument();
    expect(screen.getByText('lab-w03-first-project')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '采用第 3 周建议' }));
    await waitFor(() => expect(saved.at(-1)).toMatchObject({ currentWeek: 3, evidence: initial.evidence, completedPhaseIds: [] }));
  });

  it('still renders when the device clock is behind a valid future progress timestamp', async () => {
    const initial = createDefaultState('2099-01-01T00:00:00.000Z');
    const repository: ProgressRepository = { load: async () => structuredClone(initial), save: async () => undefined, snapshot: async () => structuredClone(initial), replace: async () => undefined };
    render(<MemoryRouter><ProgressProvider repository={repository}><DashboardPage /></ProgressProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: '今天从这里开始' })).toBeInTheDocument();
  });
});
