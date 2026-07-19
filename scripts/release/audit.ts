import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, join, resolve } from 'node:path';

export type AuditStatus = 'passed' | 'pending' | 'failed';
export interface AuditResult { id: string; status: AuditStatus; summary: string; evidence: string[] }
export interface ReleaseAudit {
  softwareReleaseReady: boolean;
  goalComplete: boolean;
  generatedAt: string;
  package?: { commit: string; sha256: string };
  results: AuditResult[];
}

interface Requirement {
  id: string;
  requirement: string;
  evidenceKind: 'file' | 'command' | 'repository' | 'deployment' | 'hardware';
  evidenceKeys: string[];
  requiredForSoftwareRelease: boolean;
  requiredForGoalCompletion: boolean;
}

interface CommandEvidence { command?: string; exitCode: number; logPath?: string; startedAt?: string; finishedAt?: string }
interface HardwareCheck {
  id: string;
  status: AuditStatus;
  evidenceSource?: 'device' | 'manual' | 'simulator';
  physicalHardware?: boolean;
  actual?: unknown;
  timestamp?: string;
  connectionNotes?: string;
}
interface EvidenceDocument {
  commands?: Record<string, CommandEvidence>;
  repository?: Record<string, {
    url?: string;
    defaultBranch?: string;
    commitSha?: string;
    verifiedAt?: string;
  }>;
  deployment?: Record<string, {
    url?: string;
    verifiedAt?: string;
    httpStatus?: number;
    assetLoad?: boolean;
    hashNavigation?: boolean;
    indexedDbPersistence?: boolean;
    commitSha?: string;
    workflowRunUrl?: string;
  }>;
  hardware?: { checks?: HardwareCheck[] };
  package?: { commit: string; sha256: string };
}

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as T : fallback;
}

function aggregate(statuses: AuditStatus[]): AuditStatus {
  if (statuses.includes('failed')) return 'failed';
  if (statuses.includes('pending')) return 'pending';
  return 'passed';
}

function hasActual(actual: unknown): boolean {
  if (actual === undefined || actual === null || actual === '') return false;
  if (typeof actual === 'object') return Object.keys(actual as object).length > 0;
  return true;
}

export async function auditRelease(
  root: string,
  evidencePath: string,
  hardwarePath?: string,
): Promise<ReleaseAudit> {
  const matrix = readJson<{ requirements: Requirement[] }>(
    join(root, 'docs', 'verification', 'requirements.json'), { requirements: [] },
  );
  const evidence = readJson<EvidenceDocument>(evidencePath, {});
  if (hardwarePath) evidence.hardware = readJson(hardwarePath, { checks: [] });

  const knownCommands = new Set(matrix.requirements.flatMap((item) => item.evidenceKeys)
    .filter((key) => key.startsWith('command:')).map((key) => key.slice(8)));
  const knownDeployments = new Set(matrix.requirements.flatMap((item) => item.evidenceKeys)
    .filter((key) => key.startsWith('deployment:')).map((key) => key.slice(11)));
  const knownRepositories = new Set(matrix.requirements.flatMap((item) => item.evidenceKeys)
    .filter((key) => key.startsWith('repository:')).map((key) => key.slice(11)));
  const knownHardware = new Set(matrix.requirements.flatMap((item) => item.evidenceKeys)
    .filter((key) => key.startsWith('hardware:')).map((key) => key.slice(9)));
  for (const key of Object.keys(evidence.commands ?? {})) {
    if (!knownCommands.has(key)) throw new Error(`Unknown command evidence key: ${key}`);
  }
  for (const key of Object.keys(evidence.deployment ?? {})) {
    if (!knownDeployments.has(key)) throw new Error(`Unknown deployment evidence key: ${key}`);
  }
  for (const key of Object.keys(evidence.repository ?? {})) {
    if (!knownRepositories.has(key)) throw new Error(`Unknown repository evidence key: ${key}`);
  }
  for (const check of evidence.hardware?.checks ?? []) {
    if (!knownHardware.has(check.id)) throw new Error(`Unknown hardware evidence key: ${check.id}`);
  }

  const results = matrix.requirements.map((requirement): AuditResult => {
    const statuses: AuditStatus[] = [];
    const direct: string[] = [];
    const reasons: string[] = [];
    for (const evidenceKey of requirement.evidenceKeys) {
      const separator = evidenceKey.indexOf(':');
      const kind = evidenceKey.slice(0, separator);
      const key = evidenceKey.slice(separator + 1);
      if (kind === 'file') {
        const path = isAbsolute(key) ? key : join(root, key);
        const present = existsSync(path);
        statuses.push(present ? 'passed' : 'pending');
        if (present) direct.push(key);
        else reasons.push(`缺少文件 ${key}`);
      } else if (kind === 'command') {
        const command = evidence.commands?.[key];
        if (!command) {
          statuses.push('pending');
          reasons.push(`命令 ${key} 尚无记录`);
        } else if (command.exitCode !== 0) {
          statuses.push('failed');
          reasons.push(`命令 ${key} 退出码 ${command.exitCode}`);
          if (command.logPath) direct.push(command.logPath);
        } else {
          statuses.push('passed');
          direct.push(command.logPath ?? command.command ?? key);
        }
      } else if (kind === 'repository') {
        const repository = evidence.repository?.[key];
        if (!repository?.url) {
          statuses.push('pending');
          reasons.push('尚无经过验证的 GitHub 仓库地址');
        } else if (repository.defaultBranch !== 'main' || !repository.commitSha || !repository.verifiedAt) {
          statuses.push('failed');
          reasons.push('GitHub 仓库存在，但 main/commit/验证时间证据不完整');
          direct.push(repository.url);
        } else {
          statuses.push('passed');
          direct.push(repository.url, `${repository.defaultBranch}@${repository.commitSha}`);
        }
      } else if (kind === 'deployment') {
        const deployment = evidence.deployment?.[key];
        if (!deployment?.url) {
          statuses.push('pending');
          reasons.push('尚无经过验证的 Pages URL');
        } else if (deployment.httpStatus !== 200 || !deployment.assetLoad ||
                   !deployment.hashNavigation || !deployment.indexedDbPersistence ||
                   !deployment.verifiedAt) {
          statuses.push('failed');
          reasons.push('Pages 地址存在，但现场加载/导航/保存证据不完整');
          direct.push(deployment.url);
        } else {
          statuses.push('passed');
          direct.push(deployment.url, deployment.workflowRunUrl ?? deployment.commitSha ?? deployment.verifiedAt);
        }
      } else if (kind === 'hardware') {
        const check = evidence.hardware?.checks?.find((item) => item.id === key);
        if (!check || check.status === 'pending') {
          statuses.push('pending');
          reasons.push(`实板检查 ${key} 待完成`);
        } else if (check.status === 'failed') {
          statuses.push('failed');
          reasons.push(`实板检查 ${key} 失败`);
        } else if (check.evidenceSource === 'simulator') {
          statuses.push('pending');
          reasons.push(`实板检查 ${key} 只有模拟证据`);
        } else if ((check.evidenceSource !== 'device' && check.evidenceSource !== 'manual') ||
                   check.physicalHardware !== true || !hasActual(check.actual) ||
                   !check.timestamp || !check.connectionNotes) {
          statuses.push('failed');
          reasons.push(`实板检查 ${key} 的直接证据字段不完整`);
        } else {
          statuses.push('passed');
          direct.push(`${key}: ${JSON.stringify(check.actual)}`);
        }
      } else {
        throw new Error(`Unknown evidence key kind: ${evidenceKey}`);
      }
    }
    const status = aggregate(statuses);
    return {
      id: requirement.id,
      status,
      summary: status === 'passed' ? requirement.requirement : reasons.join('；'),
      evidence: direct,
    };
  });

  const byId = new Map(results.map((result) => [result.id, result]));
  return {
    softwareReleaseReady: matrix.requirements
      .filter((item) => item.requiredForSoftwareRelease)
      .every((item) => byId.get(item.id)?.status === 'passed'),
    goalComplete: matrix.requirements
      .filter((item) => item.requiredForGoalCompletion)
      .every((item) => byId.get(item.id)?.status === 'passed'),
    generatedAt: new Date().toISOString(),
    package: evidence.package,
    results,
  };
}

export function renderAuditMarkdown(audit: ReleaseAudit): string {
  const statusLabel = { passed: '通过', pending: '待验证', failed: '失败' } as const;
  const lines = [
    '# STM32 学习平台验证报告', '',
    `生成时间：${audit.generatedAt}`, '',
    `软件发布状态：${audit.softwareReleaseReady ? '可以发布' : '尚未达到发布门槛'}`,
    `完整目标状态：${audit.goalComplete ? '全部完成' : '仍有待验证或失败项'}`, '',
    ...(audit.package ? [
      '## 交付包指纹', '',
      `- Git commit: ${audit.package.commit}`,
      `- SHA-256: ${audit.package.sha256}`, '',
    ] : []),
    '| 要求 | 状态 | 说明 |', '| --- | --- | --- |',
  ];
  for (const result of audit.results) {
    lines.push(`| ${result.id} | ${statusLabel[result.status]} | ${result.summary.replaceAll('|', '\\|')} |`);
  }
  lines.push('', '## 直接证据', '');
  for (const result of audit.results) {
    if (result.evidence.length) lines.push(`- ${result.id}: ${result.evidence.join('；')}`);
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = process.argv.slice(2);
  const value = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const root = resolve(value('--root') ?? process.cwd());
  const evidencePath = resolve(value('--evidence') ?? join(root, 'work', 'release-evidence.json'));
  const hardware = value('--hardware');
  const output = resolve(value('--output') ?? join(root, 'outputs', 'stm32-learning-platform-verification.md'));
  const audit = await auditRelease(root, evidencePath, hardware ? resolve(hardware) : undefined);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, renderAuditMarkdown(audit), 'utf8');
  process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
