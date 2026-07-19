import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const DOCS = [
  'docs/learner/getting-started.md',
  'docs/learner/weekly-routine.md',
  'docs/learner/github-notes.md',
  'docs/learner/backup-restore.md',
  'docs/learner/device-connection.md',
  'docs/learner/troubleshooting.md',
];

describe('non-programmer learner documentation', () => {
  it.each(DOCS)('%s exists, uses Chinese headings, and has no dead local link', (relative) => {
    const path = join(ROOT, relative);
    expect(existsSync(path), `${relative} missing`).toBe(true);
    const markdown = readFileSync(path, 'utf8');
    expect(markdown).toMatch(/^# .*?[\u4e00-\u9fff]/m);
    for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (/^(?:https?:|#)/.test(target)) continue;
      expect(existsSync(resolve(dirname(path), target)), `${relative} -> ${target}`).toBe(true);
    }
  });

  it('names every required recovery path', () => {
    const troubleshooting = readFileSync(join(ROOT, 'docs/learner/troubleshooting.md'), 'utf8');
    for (const problem of [
      '找不到编译器', 'CubeMX 生成失败', 'CMake 构建失败', 'ST-LINK 无法连接',
      '程序下载后无现象', 'CH340 无串口', '浏览器不支持 Web Serial',
      '串口授权被拒绝', '固件版本不匹配', '备份导入失败', '恢复旧数据',
    ]) expect(troubleshooting).toContain(problem);
  });

  it('README links all learner and verification entry points', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    for (const target of [
      'docs/learner/getting-started.md', 'docs/learner/weekly-routine.md',
      'docs/learner/github-notes.md', 'docs/learner/backup-restore.md',
      'docs/learner/device-connection.md', 'docs/learner/troubleshooting.md',
      'docs/superpowers/specs/2026-07-19-stm32-learning-platform-design.md',
      'docs/verification/hardware-smoke-test.md',
    ]) expect(readme).toContain(target);
  });
});
