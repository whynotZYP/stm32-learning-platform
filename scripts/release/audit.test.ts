import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { auditRelease, renderAuditMarkdown } from './audit';

const roots: string[] = [];

function fixture(requirement: Record<string, unknown>, evidence: Record<string, unknown> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'stm32-audit-'));
  roots.push(root);
  mkdirSync(join(root, 'docs', 'verification'), { recursive: true });
  writeFileSync(join(root, 'docs', 'verification', 'requirements.json'), JSON.stringify({ schemaVersion: 1, requirements: [requirement] }));
  const evidencePath = join(root, 'evidence.json');
  writeFileSync(evidencePath, JSON.stringify(evidence));
  return { root, evidencePath };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('release auditor truthfulness', () => {
  it('passes direct file evidence', async () => {
    const { root, evidencePath } = fixture({ id: 'DIRECT', requirement: 'direct', evidenceKind: 'file', evidenceKeys: ['file:proof.txt'], requiredForSoftwareRelease: true, requiredForGoalCompletion: true });
    writeFileSync(join(root, 'proof.txt'), 'proof');
    const audit = await auditRelease(root, evidencePath);
    expect(audit.results[0].status).toBe('passed');
    expect(audit.softwareReleaseReady).toBe(true);
    expect(audit.goalComplete).toBe(true);
  });

  it.each([
    [{}, 'pending'],
    [{ commands: { test: { exitCode: 1, command: 'test' } } }, 'failed'],
  ] as const)('maps command evidence to %s', async (evidence, status) => {
    const { root, evidencePath } = fixture({ id: 'COMMAND', requirement: 'command', evidenceKind: 'command', evidenceKeys: ['command:test'], requiredForSoftwareRelease: true, requiredForGoalCompletion: true }, evidence);
    const audit = await auditRelease(root, evidencePath);
    expect(audit.results[0].status).toBe(status);
  });

  it('keeps simulator evidence pending for physical hardware', async () => {
    const hardware = { schemaVersion: 1, checks: [{ id: 'gpio', status: 'passed', evidenceSource: 'simulator', physicalHardware: true, actual: { low: 0, high: 1 }, timestamp: '2026-07-20T00:00:00Z', connectionNotes: 'simulated' }] };
    const { root, evidencePath } = fixture({ id: 'REAL_HARDWARE', requirement: 'hardware', evidenceKind: 'hardware', evidenceKeys: ['hardware:gpio'], requiredForSoftwareRelease: false, requiredForGoalCompletion: true }, { hardware });
    const audit = await auditRelease(root, evidencePath);
    expect(audit.results[0]).toMatchObject({ status: 'pending' });
    expect(audit.results[0].summary).toContain('模拟');
    expect(renderAuditMarkdown(audit)).not.toContain('全部完成');
  });

  it('keeps Pages pending without a verified URL', async () => {
    const { root, evidencePath } = fixture({ id: 'GITHUB_PAGES', requirement: 'pages', evidenceKind: 'deployment', evidenceKeys: ['deployment:pages'], requiredForSoftwareRelease: true, requiredForGoalCompletion: true });
    const audit = await auditRelease(root, evidencePath);
    expect(audit.results[0].status).toBe('pending');
    expect(audit.softwareReleaseReady).toBe(false);
  });

  it('renders the package commit and SHA-256 when recorded', async () => {
    const { root, evidencePath } = fixture(
      { id: 'DIRECT', requirement: 'direct', evidenceKind: 'file', evidenceKeys: ['file:proof.txt'], requiredForSoftwareRelease: true, requiredForGoalCompletion: true },
      { package: { commit: 'abc1234', sha256: '0123456789abcdef' } },
    );
    writeFileSync(join(root, 'proof.txt'), 'proof');
    const report = renderAuditMarkdown(await auditRelease(root, evidencePath));
    expect(report).toContain('abc1234');
    expect(report).toContain('0123456789abcdef');
  });

  it('accepts a directly verified GitHub repository upload on main', async () => {
    const { root, evidencePath } = fixture(
      { id: 'GITHUB_REPOSITORY', requirement: 'uploaded', evidenceKind: 'repository', evidenceKeys: ['repository:github'], requiredForSoftwareRelease: true, requiredForGoalCompletion: true },
      { repository: { github: { url: 'https://github.com/example/project', defaultBranch: 'main', commitSha: 'abc1234', verifiedAt: '2026-07-20T00:00:00Z' } } },
    );
    const audit = await auditRelease(root, evidencePath);
    expect(audit.results[0]).toMatchObject({ status: 'passed' });
    expect(audit.results[0].evidence).toContain('https://github.com/example/project');
  });
});
