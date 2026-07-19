import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function compiler() {
  const candidates = [process.env.HOST_CC, 'clang', 'gcc', 'cc', 'tcc'].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if ((candidate.includes('\\') || candidate.includes('/')) && !existsSync(candidate)) continue;
    const result = spawnSync(candidate, /^tcc(?:\.exe)?$/i.test(basename(candidate)) ? ['-v'] : ['--version'], { encoding: 'utf8' });
    if (result.status === 0) return candidate;
  }
  throw new Error('Set HOST_CC to a native C compiler.');
}

describe('device-test-v1 firmware contract', () => {
  it('parses bounded protocol v1 requests and exposes the exact safe 15-test registry', () => {
    const build = mkdtempSync(join(tmpdir(), 'device-test-v1-'));
    const executable = join(build, process.platform === 'win32' ? 'device-test-host.exe' : 'device-test-host');
    const app = join(ROOT, 'firmware', 'device-test-v1', 'App');
    try {
      const result = spawnSync(compiler(), [
        '-std=c11', '-Wall', '-Wextra', '-Werror', '-I', app,
        join(ROOT, 'scripts', 'firmware', 'device-test-host-harness.c'),
        join(app, 'device_protocol.c'), join(app, 'device_tests.c'), '-o', executable,
      ], { encoding: 'utf8' });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      const run = spawnSync(executable, [], { encoding: 'utf8' });
      expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
    } finally {
      rmSync(build, { recursive: true, force: true });
    }
  });

  it('keeps destructive and interrupt-driven checks honest', () => {
    const app = join(ROOT, 'firmware', 'device-test-v1', 'App');
    const hardware = readFileSync(join(app, 'device_tests_stm32.c'), 'utf8');
    const serial = readFileSync(join(app, 'app.c'), 'utf8');
    expect(hardware).toContain('DMA_CCR_MEM2MEM');
    expect(hardware).not.toMatch(/DMA_CCR_MEM2MEM\s*\|\s*DMA_CCR_DIR/);
    expect(hardware).toContain('GPIO_MODE_IT_FALLING');
    expect(hardware).toContain('EXTI1_IRQHandler');
    expect(hardware).toContain('elapsed_ms > 0U');
    expect(hardware).toContain('w25_is_expected_device');
    expect(hardware).toContain('w25_verify_sector');
    expect(serial).toContain('discarding_line');
    expect(serial).toContain("character == '\\0'");
    expect(serial).not.toContain("character == '\\r') return");
  });
});
