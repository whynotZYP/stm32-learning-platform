import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TOOLCHAIN_BIN = 'F:/stm/STM32CubeCLT_1.22.0/st-arm-clang/bin';
const ST_CLANG = join(TOOLCHAIN_BIN, 'starm-clang.exe');
const ST_LINK = join(TOOLCHAIN_BIN, 'lld-link.exe');
const SOURCES = [
  'firmware/lessons/w13-adc-dma/App/dma_snapshot.c',
  'firmware/lessons/w14-usart/App/usart_rx.c',
  'firmware/lessons/w15-usart-packets/App/packet_parser.c',
  'firmware/lessons/w16-i2c-mpu6050-id/App/mpu6050_id.c',
];
const CASES = [
  [1, 'publishes one complete DMA frame'],
  [2, 'keeps a DMA snapshot stable while the source buffer changes'],
  [3, 'queues a USART byte and requests RX rearm'],
  [4, 'classifies ORE as clear-and-rearm recovery'],
  [5, 'parses a packet delivered in partial chunks'],
  [6, 'parses two concatenated packets'],
  [7, 'rejects a corrupt checksum'],
  [8, 'drops an incomplete packet after the bounded timeout'],
  [9, 'rejects an oversized packet before writing its payload'],
  [10, 'uses the MPU6050 7-bit, HAL and WHO_AM_I addresses'],
  [11, 'distinguishes MPU6050 timeout, bus error and wrong ID'],
  [12, 'keeps the new SOF byte that triggers dropped-packet timeout recovery'],
  [13, 'recovers with a valid packet after an oversized length'],
  [14, 'rearms USART RX after a generic receive error'],
  [15, 'drops the newest USART byte and counts a full queue'],
  [16, 'resynchronizes when a new SOF arrives in the packet length position'],
] as const;

let buildDir = '';
const productionObjects: string[] = [];
let compiler = '';
let linker = '';
let stFallback = false;

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${basename(command)} failed (${result.status})\n${result.stdout}\n${result.stderr}`);
}

function resolves(command: string) {
  const longVersion = spawnSync(command, ['--version'], { encoding: 'utf8' });
  if (longVersion.status === 0) return true;
  return spawnSync(command, ['-v'], { encoding: 'utf8' }).status === 0;
}

function resolveCompiler() {
  const candidates = [process.env.HOST_CC, 'clang', 'gcc', 'cc'].filter((value): value is string => Boolean(value));
  const portable = candidates.find(resolves);
  if (portable) return portable;
  if (process.platform === 'win32' && existsSync(ST_CLANG) && existsSync(ST_LINK)) {
    stFallback = true;
    linker = ST_LINK;
    return ST_CLANG;
  }
  throw new Error('No host C compiler found. Set HOST_CC to clang, gcc or cc.');
}

beforeAll(async () => {
  compiler = resolveCompiler();
  for (const source of SOURCES) expect(existsSync(join(ROOT, source)), `missing production source ${source}`).toBe(true);
  buildDir = await mkdtemp(join(tmpdir(), 'stm32-phase04-host-'));
  for (const [index, source] of SOURCES.entries()) {
    const object = join(buildDir, `production-${index}.obj`);
    const target = stFallback ? ['--target=x86_64-pc-windows-msvc', '-ffreestanding', '-fno-builtin'] : [];
    run(compiler, [...target, '-std=c11', '-Wall', '-Wextra', '-Werror', '-c', join(ROOT, source), '-o', object]);
    productionObjects.push(object);
  }
});

afterAll(async () => { if (buildDir) await rm(buildDir, { recursive: true, force: true }); });

describe('phase 4 production C behavior on the host', () => {
  for (const [testCase, name] of CASES) {
    it(name, () => {
      const harnessObject = join(buildDir, `harness-${testCase}.obj`);
      const executable = join(buildDir, `case-${testCase}.exe`);
      const target = stFallback ? ['--target=x86_64-pc-windows-msvc', '-ffreestanding', '-fno-builtin', '-DHOST_ST_FREESTANDING=1'] : [];
      run(compiler, [
        ...target, '-std=c11', '-Wall', '-Wextra', '-Werror',
        `-DTEST_CASE=${testCase}`, '-I', join(ROOT, 'firmware/lessons/w13-adc-dma/App'), '-I', join(ROOT, 'firmware/lessons/w14-usart/App'),
        '-I', join(ROOT, 'firmware/lessons/w15-usart-packets/App'), '-I', join(ROOT, 'firmware/lessons/w16-i2c-mpu6050-id/App'),
        '-c', join(ROOT, 'scripts/firmware-host/phase-04-host-harness.c'), '-o', harnessObject,
      ]);
      if (stFallback) run(linker, [harnessObject, ...productionObjects, '/entry:mainCRTStartup', '/subsystem:console', '/nodefaultlib', `/out:${executable}`]);
      else run(compiler, [harnessObject, ...productionObjects, '-o', executable]);
      const result = spawnSync(executable, [], { encoding: 'utf8' });
      expect(result.status, `case ${testCase} failed: ${result.stderr}`).toBe(0);
    });
  }

  it('kills a checksum acceptance mutant by compiling and executing it', async () => {
    const productionParser = join(ROOT, 'firmware/lessons/w15-usart-packets/App/packet_parser.c');
    const mutantSource = join(buildDir, 'packet-parser-mutant.c');
    const mutantObject = join(buildDir, 'packet-parser-mutant.obj');
    const harnessObject = join(buildDir, 'harness-mutant.obj');
    const executable = join(buildDir, 'case-mutant.exe');
    const target = stFallback ? ['--target=x86_64-pc-windows-msvc', '-ffreestanding', '-fno-builtin'] : [];
    const harnessTarget = stFallback ? [...target, '-DHOST_ST_FREESTANDING=1'] : target;

    const productionCode = await readFile(productionParser, 'utf8');
    const mutantCode = productionCode.replace(
      '(uint8_t)(parser->checksum + byte) != 0U',
      '(uint8_t)(parser->checksum + byte) == 0U',
    );
    if (mutantCode === productionCode) throw new Error('checksum mutation target was not found');
    await writeFile(mutantSource, mutantCode, 'utf8');
    run(compiler, [...target, '-std=c11', '-Wall', '-Wextra', '-Werror', '-I', join(ROOT, 'firmware/lessons/w15-usart-packets/App'), '-c', mutantSource, '-o', mutantObject]);
    run(compiler, [
      ...harnessTarget, '-std=c11', '-Wall', '-Wextra', '-Werror', '-DTEST_CASE=7',
      '-I', join(ROOT, 'firmware/lessons/w13-adc-dma/App'), '-I', join(ROOT, 'firmware/lessons/w14-usart/App'),
      '-I', join(ROOT, 'firmware/lessons/w15-usart-packets/App'), '-I', join(ROOT, 'firmware/lessons/w16-i2c-mpu6050-id/App'),
      '-c', join(ROOT, 'scripts/firmware-host/phase-04-host-harness.c'), '-o', harnessObject,
    ]);
    const unmutatedObjects = productionObjects.filter((_, index) => index !== 2);
    if (stFallback) run(linker, [harnessObject, ...unmutatedObjects, mutantObject, '/entry:mainCRTStartup', '/subsystem:console', '/nodefaultlib', `/out:${executable}`]);
    else run(compiler, [harnessObject, ...unmutatedObjects, mutantObject, '-o', executable]);

    const result = spawnSync(executable, [], { encoding: 'utf8' });
    expect(result.status, 'the checksum mutant survived case 7').not.toBe(0);
  });
});
