import type { EvidenceRecord } from '../../domain/progress/types';
import type { DeviceRunOutcome } from '../runner/runDeviceTest';

export function deviceResultToEvidence(
  outcome: DeviceRunOutcome,
  lessonId: string,
): EvidenceRecord {
  const simulated = outcome.transportKind === 'simulator';
  const automatic = outcome.definition.detectionCheck.mode === 'automatic'
    && outcome.definition.detectionCheck.applicable
    && outcome.definition.detectionCheck.evidenceSource === 'device'
    && outcome.definition.detectionCheck.physicalHardware;
  const passed = outcome.result.status === 'pass';
  const status = simulated || !automatic
    ? 'pending'
    : passed
      ? 'auto-pass'
      : 'failed';

  return {
    id: `device-${outcome.result.id}`,
    learnerId: 'local',
    lessonId,
    tagIds: [...outcome.definition.lessonTagIds],
    kind: 'practical',
    status,
    score: status === 'auto-pass' ? 100 : 0,
    source: 'device',
    createdAt: outcome.receivedAt,
    details: {
      ...outcome.result.details,
      testId: outcome.definition.id,
      simulated,
    },
  };
}
