import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultState } from '../domain/progress/defaultState';
import type { EvidenceRecord, LearnerState } from '../domain/progress/types';
import type { ProgressRepository } from '../domain/progress/repository';
import { ProgressProvider, useProgress } from './ProgressContext';

afterEach(cleanup);

const evidence: EvidenceRecord = {
  id: 'evidence-1',
  learnerId: 'local',
  lessonId: 'w04-gpio-output',
  tagIds: ['gpio.output-mode'],
  kind: 'practical',
  status: 'manual-confirmed',
  score: 100,
  source: 'manual',
  createdAt: '2026-07-19T00:00:00.000Z',
  details: {},
};

function createMemoryRepository(initial = createDefaultState('2026-07-19T00:00:00.000Z')): ProgressRepository & { saved: LearnerState[] } {
  let state = initial;
  const saved: LearnerState[] = [];

  return {
    saved,
    async load() { return state; },
    async save(next) { state = next; saved.push(next); },
    async snapshot() { return state; },
    async replace(next) { state = next; },
  };
}

function EvidenceRecorder() {
  const { loading, state, recordEvidence } = useProgress();
  if (loading) return <p>正在读取本机学习进度…</p>;

  return <>
    <button onClick={() => void recordEvidence(evidence)}>记录证据</button>
    <p>{`证据数：${state.evidence.length}`}</p>
  </>;
}

describe('ProgressProvider', () => {
  it('records evidence in the repository and updates its consumer', async () => {
    const repository = createMemoryRepository();
    render(<ProgressProvider repository={repository}><EvidenceRecorder /></ProgressProvider>);

    await screen.findByRole('button', { name: '记录证据' });
    await act(async () => { screen.getByRole('button', { name: '记录证据' }).click(); });

    expect(screen.getByText('证据数：1')).toBeInTheDocument();
    expect(repository.saved).toHaveLength(1);
    expect(repository.saved[0].evidence).toEqual([evidence]);
  });

  it('explains a local progress loading error in plain Chinese', async () => {
    const repository: ProgressRepository = {
      load: async () => { throw new Error('IndexedDB unavailable'); },
      save: async () => undefined,
      snapshot: async () => createDefaultState(),
      replace: async () => undefined,
    };

    function LoadStatus() {
      const { error, loading } = useProgress();
      if (loading) return <p>正在读取本机学习进度…</p>;
      return <p>{error}</p>;
    }

    render(<ProgressProvider repository={repository}><LoadStatus /></ProgressProvider>);

    expect(await screen.findByText('暂时无法读取本机学习进度，请刷新页面后重试。')).toBeInTheDocument();
  });
});
