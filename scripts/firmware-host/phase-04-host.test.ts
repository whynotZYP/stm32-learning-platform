import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
type ProductionName = 'dma' | 'w14Usart' | 'w15Usart' | 'parser' | 'mpu';
const SOURCES = [
  { name: 'dma', source: 'firmware/lessons/w13-adc-dma/App/dma_snapshot.c' },
  { name: 'w14Usart', source: 'firmware/lessons/w14-usart/App/usart_rx.c' },
  { name: 'w15Usart', source: 'firmware/lessons/w15-usart-packets/App/usart_rx.c' },
  { name: 'parser', source: 'firmware/lessons/w15-usart-packets/App/packet_parser.c' },
  { name: 'mpu', source: 'firmware/lessons/w16-i2c-mpu6050-id/App/mpu6050_id.c' },
] as const satisfies ReadonlyArray<{ name: ProductionName; source: string }>;
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
const productionObjects = {} as Record<ProductionName, string>;

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${basename(command)} failed (${result.status})\n${result.stdout}\n${result.stderr}`);
}

function compilesAndRunsNative(command: string) {
  const probeDir = mkdtempSync(join(tmpdir(), 'stm32-phase04-cc-probe-'));
  const source = join(probeDir, 'probe.c');
  const executable = join(probeDir, process.platform === 'win32' ? 'probe.exe' : 'probe');
  try {
    writeFileSync(source, 'int main(void) { return 0; }\n', 'utf8');
    const compile = spawnSync(command, ['-std=c11', source, '-o', executable], { encoding: 'utf8' });
    if (compile.status !== 0) return false;
    return spawnSync(executable, [], { encoding: 'utf8' }).status === 0;
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }
}

function resolveCompiler() {
  if (process.env.HOST_CC) {
    if (compilesAndRunsNative(process.env.HOST_CC)) return process.env.HOST_CC;
    throw new Error(`HOST_CC '${process.env.HOST_CC}' is not a usable native host C compiler.`);
  }
  const compiler = ['clang', 'gcc', 'cc'].find(compilesAndRunsNative);
  if (compiler) return compiler;
  throw new Error('No usable native host C compiler found. Set HOST_CC to clang, gcc or cc.');
}

const compiler = resolveCompiler();

function objectsForCase(testCase: number) {
  return [
    productionObjects.dma,
    testCase === 15 ? productionObjects.w15Usart : productionObjects.w14Usart,
    productionObjects.parser,
    productionObjects.mpu,
  ];
}

beforeAll(async () => {
  for (const { source } of SOURCES) expect(existsSync(join(ROOT, source)), `missing production source ${source}`).toBe(true);
  buildDir = await mkdtemp(join(tmpdir(), 'stm32-phase04-host-'));
  for (const { name, source } of SOURCES) {
    const object = join(buildDir, `${name}.obj`);
    run(compiler, ['-std=c11', '-Wall', '-Wextra', '-Werror', '-c', join(ROOT, source), '-o', object]);
    productionObjects[name] = object;
  }
});

afterAll(async () => { if (buildDir) await rm(buildDir, { recursive: true, force: true }); });

describe('phase 4 production C behavior on the host', () => {
  for (const [testCase, name] of CASES) {
    it(name, () => {
      const harnessObject = join(buildDir, `harness-${testCase}.obj`);
      const executable = join(buildDir, `case-${testCase}.exe`);
      run(compiler, [
        '-std=c11', '-Wall', '-Wextra', '-Werror',
        `-DTEST_CASE=${testCase}`, '-I', join(ROOT, 'firmware/lessons/w13-adc-dma/App'), '-I', join(ROOT, 'firmware/lessons/w14-usart/App'),
        '-I', join(ROOT, 'firmware/lessons/w15-usart-packets/App'), '-I', join(ROOT, 'firmware/lessons/w16-i2c-mpu6050-id/App'),
        '-c', join(ROOT, 'scripts/firmware-host/phase-04-host-harness.c'), '-o', harnessObject,
      ]);
      run(compiler, [harnessObject, ...objectsForCase(testCase), '-o', executable]);
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

    const productionCode = await readFile(productionParser, 'utf8');
    const mutantCode = productionCode.replace(
      '(uint8_t)(parser->checksum + byte) != 0U',
      '(uint8_t)(parser->checksum + byte) == 0U',
    );
    if (mutantCode === productionCode) throw new Error('checksum mutation target was not found');
    await writeFile(mutantSource, mutantCode, 'utf8');
    run(compiler, ['-std=c11', '-Wall', '-Wextra', '-Werror', '-I', join(ROOT, 'firmware/lessons/w15-usart-packets/App'), '-c', mutantSource, '-o', mutantObject]);
    run(compiler, [
      '-std=c11', '-Wall', '-Wextra', '-Werror', '-DTEST_CASE=7',
      '-I', join(ROOT, 'firmware/lessons/w13-adc-dma/App'), '-I', join(ROOT, 'firmware/lessons/w14-usart/App'),
      '-I', join(ROOT, 'firmware/lessons/w15-usart-packets/App'), '-I', join(ROOT, 'firmware/lessons/w16-i2c-mpu6050-id/App'),
      '-c', join(ROOT, 'scripts/firmware-host/phase-04-host-harness.c'), '-o', harnessObject,
    ]);
    const unmutatedObjects = [productionObjects.dma, productionObjects.w14Usart, productionObjects.mpu];
    run(compiler, [harnessObject, ...unmutatedObjects, mutantObject, '-o', executable]);

    const result = spawnSync(executable, [], { encoding: 'utf8' });
    expect(result.status, 'the checksum mutant survived case 7').not.toBe(0);
  });
});
