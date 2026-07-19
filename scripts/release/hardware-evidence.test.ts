import { describe, expect, it } from 'vitest';

import { validateHardwareEvidence, type HardwareEvidenceDocument } from './hardwareEvidence';

function documentWith(check: HardwareEvidenceDocument['checks'][number]): HardwareEvidenceDocument {
  return {
    schemaVersion: 1,
    board: 'STM32F103C8T6',
    adapter: 'ST-LINK V2',
    firmware: 'device-test-v1',
    tester: '',
    startedAt: null,
    finishedAt: null,
    checks: [check],
  };
}

describe('hardware evidence', () => {
  it('accepts an honest pending check', () => {
    const problems = validateHardwareEvidence(documentWith({
      id: 'gpio-loopback', status: 'pending', evidenceSource: null,
      physicalHardware: true, actual: {}, timestamp: null, connectionNotes: '',
    }));
    expect(problems).toEqual([]);
  });

  it('rejects a claimed pass without direct physical evidence', () => {
    const problems = validateHardwareEvidence(documentWith({
      id: 'gpio-loopback', status: 'passed', evidenceSource: null,
      physicalHardware: true, actual: {}, timestamp: null, connectionNotes: '',
    }));
    expect(problems).toHaveLength(4);
  });

  it('accepts a complete device measurement', () => {
    const problems = validateHardwareEvidence(documentWith({
      id: 'gpio-loopback', status: 'passed', evidenceSource: 'device',
      physicalHardware: true, actual: { low: 0, high: 1 },
      timestamp: '2026-07-20T00:00:00Z', connectionNotes: 'PA0 jumper to PB0',
    }));
    expect(problems).toEqual([]);
  });
});
