import { spawnSync } from 'node:child_process';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const temporaryRoots: string[] = [];
const powershell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';

interface FixtureProject { id: string; path: string }

async function fixture(projects: FixtureProject[]) {
  const root = await mkdtemp(join(tmpdir(), 'stm32 phase8 '));
  temporaryRoots.push(root);
  const scriptDirectory = join(root, 'scripts', 'firmware');
  const fakeBin = join(root, 'fake cmake bin');
  await mkdir(scriptDirectory, { recursive: true });
  await mkdir(join(root, 'firmware'), { recursive: true });
  await mkdir(fakeBin, { recursive: true });
  await copyFile(join(ROOT, 'scripts', 'firmware', 'build-all.ps1'), join(scriptDirectory, 'build-all.ps1'));
  await writeFile(join(root, 'firmware', 'projects.json'), `${JSON.stringify({ projects }, null, 2)}\n`, 'utf8');
  for (const project of projects) await mkdir(join(root, project.path), { recursive: true });

  if (process.platform === 'win32') {
    await writeFile(join(fakeBin, 'cmake.cmd'), [
      '@echo off',
      'set "phase=configure"',
      'if "%1"=="--build" set "phase=build"',
      'for %%I in ("%CD%") do set "project=%%~nxI"',
      '>> "%FAKE_CMAKE_LOG%" echo %CD%^|%phase%^|%*',
      'if "%project%"=="%FAKE_CMAKE_FAIL_PROJECT%" if "%phase%"=="%FAKE_CMAKE_FAIL_PHASE%" exit /b %FAKE_CMAKE_EXIT_CODE%',
      'exit /b 0',
      '',
    ].join('\r\n'), 'utf8');
  } else {
    const command = join(fakeBin, 'cmake');
    await writeFile(command, [
      '#!/usr/bin/env sh',
      'phase=configure',
      '[ "$1" = "--build" ] && phase=build',
      'project=$(basename "$PWD")',
      'printf "%s|%s|%s\\n" "$PWD" "$phase" "$*" >> "$FAKE_CMAKE_LOG"',
      '[ "$project" = "$FAKE_CMAKE_FAIL_PROJECT" ] && [ "$phase" = "$FAKE_CMAKE_FAIL_PHASE" ] && exit "$FAKE_CMAKE_EXIT_CODE"',
      'exit 0',
      '',
    ].join('\n'), 'utf8');
    await chmod(command, 0o755);
  }
  return { root, fakeBin, log: join(root, 'cmake.log'), script: join(scriptDirectory, 'build-all.ps1') };
}

function run(script: string, fakeBin: string, log: string, options: { failProject?: string; failPhase?: string; exitCode?: number } = {}) {
  const caller = join(script, '..', '..', '..');
  const escapedScript = script.replace(/'/g, "''");
  const command = `$before = (Get-Location).Path; try { & '${escapedScript}' } finally { if ((Get-Location).Path -ne $before) { throw 'runner did not restore caller location' } }`;
  return spawnSync(powershell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
    cwd: caller,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ''}`,
      FAKE_CMAKE_LOG: log,
      FAKE_CMAKE_FAIL_PROJECT: options.failProject ?? '',
      FAKE_CMAKE_FAIL_PHASE: options.failPhase ?? '',
      FAKE_CMAKE_EXIT_CODE: String(options.exitCode ?? 23),
    },
  });
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('build-all.ps1', () => {
  it('uses the UTF-8 repository manifest from a caller path containing spaces and restores location', async () => {
    const projects = [
      { id: 'alpha', path: 'firmware/lessons/project one' },
      { id: 'beta', path: 'firmware/lessons/项目 二' },
    ];
    const current = await fixture(projects);
    const result = run(current.script, current.fakeBin, current.log);
    expect(result.status, result.stderr).toBe(0);
    const log = (await readFile(current.log, 'utf8')).trim().split(/\r?\n/).map((line) => line.split('|'));
    expect(log.map(([, phase, args]) => [phase, args])).toEqual([
      ['configure', '--preset Debug --fresh'], ['build', '--build --preset Debug --parallel'],
      ['configure', '--preset Debug --fresh'], ['build', '--build --preset Debug --parallel'],
    ]);
    expect(log.map(([directory]) => directory)).toEqual(projects.flatMap((project) => [join(current.root, project.path), join(current.root, project.path)]));
    expect(result.stdout).toContain('固件构建通过：2 个工程。');
  });

  it.each(['configure', 'build'] as const)('fails fast on a %s error and reports project id plus cmake exit code', async (phase) => {
    const projects = ['first', 'broken', 'never'].map((id) => ({ id, path: `firmware/lessons/${id}` }));
    const current = await fixture(projects);
    const result = run(current.script, current.fakeBin, current.log, { failProject: 'broken', failPhase: phase, exitCode: 23 });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('broken');
    expect(`${result.stdout}\n${result.stderr}`).toContain('23');
    const log = await readFile(current.log, 'utf8');
    expect(log).not.toContain('never');
  });

  it('reports the manifest project id when its source directory is missing', async () => {
    const project = { id: 'matrix-entry-id', path: 'firmware/lessons/missing-source' };
    const current = await fixture([project]);
    await rm(join(current.root, project.path), { recursive: true });
    const result = run(current.script, current.fakeBin, current.log);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(project.id);
  });

  it('keeps the npm entry point exact and the runner contract explicit', async () => {
    const packageJson = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(packageJson.scripts['build:firmware']).toBe('powershell -NoProfile -ExecutionPolicy Bypass -File scripts/firmware/build-all.ps1');
    const source = await readFile(join(ROOT, 'scripts/firmware/build-all.ps1'), 'utf8');
    expect(source).toContain("Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8");
    expect(source).toContain('& cmake --preset Debug --fresh');
    expect(source).toContain('& cmake --build --preset Debug --parallel');
    expect(source).toMatch(/Push-Location[\s\S]+try[\s\S]+finally[\s\S]+Pop-Location/);
  });
});
