export type HardwareEvidenceStatus = 'passed' | 'pending' | 'failed';

export interface HardwareEvidenceCheck {
  id: string;
  status: HardwareEvidenceStatus;
  evidenceSource: 'device' | 'manual' | null;
  physicalHardware: true;
  actual: Record<string, unknown>;
  timestamp: string | null;
  connectionNotes: string;
}

export interface HardwareEvidenceDocument {
  schemaVersion: 1;
  board: string;
  adapter: string;
  firmware: string;
  tester: string;
  startedAt: string | null;
  finishedAt: string | null;
  checks: HardwareEvidenceCheck[];
}

export function validateHardwareEvidence(document: HardwareEvidenceDocument): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const check of document.checks) {
    if (ids.has(check.id)) problems.push(`重复检查项: ${check.id}`);
    ids.add(check.id);
    if (check.physicalHardware !== true) problems.push(`${check.id}: 必须是实板证据`);
    if (check.status === 'passed') {
      if (check.evidenceSource !== 'device' && check.evidenceSource !== 'manual') {
        problems.push(`${check.id}: 通过项必须注明直接证据来源`);
      }
      if (!check.timestamp) problems.push(`${check.id}: 通过项缺少时间`);
      if (!check.connectionNotes.trim()) problems.push(`${check.id}: 通过项缺少接线说明`);
      if (Object.keys(check.actual).length === 0) problems.push(`${check.id}: 通过项缺少实际结果`);
    }
  }
  return problems;
}
