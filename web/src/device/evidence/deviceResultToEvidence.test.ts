import { describe, expect, it } from 'vitest';

import { getDeviceTest } from '../catalog/testCatalog';
import type { DeviceRunOutcome } from '../runner/runDeviceTest';
import { deviceResultToEvidence } from './deviceResultToEvidence';

function outcome(input: {
  transportKind: 'serial' | 'simulator';
  testId?: string;
  status: 'pass' | 'fail';
}): DeviceRunOutcome {
  const testId = input.testId ?? 'system.hello';
  return {
    definition: getDeviceTest(testId),
    transportKind: input.transportKind,
    result: {
      v: 1,
      id: `req-${input.transportKind}-${input.status}`,
      type: 'result',
      test: testId,
      status: input.status,
      details: input.transportKind === 'simulator' ? { simulated: true } : { firmware: 'device-test-v1' },
    },
    receivedAt: '2026-07-19T12:00:00.000Z',
  };
}

describe('deviceResultToEvidence', () => {
  it.each([
    ['serial', 'pass', 'auto-pass', 100],
    ['serial', 'fail', 'failed', 0],
    ['simulator', 'pass', 'pending', 0],
  ] as const)('maps %s %s to honest %s evidence', (transportKind, status, evidenceStatus, score) => {
    const evidence = deviceResultToEvidence(outcome({ transportKind, status }), 'w03-first-project');

    expect(evidence).toMatchObject({
      lessonId: 'w03-first-project',
      status: evidenceStatus,
      score,
      source: 'device',
      details: { testId: 'system.hello', simulated: transportKind === 'simulator' },
    });
  });

  it('keeps a semi-automatic serial pass pending until separate learner confirmation', () => {
    const evidence = deviceResultToEvidence(outcome({
      transportKind: 'serial',
      testId: 'exti.event-count',
      status: 'pass',
    }), 'w07-exti-events');

    expect(evidence.status).toBe('pending');
    expect(evidence.score).toBe(0);
  });
});
