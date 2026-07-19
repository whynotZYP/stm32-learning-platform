import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const WEEKS = [
  { week: 21, suffix: 'w21', id: 'w21-rtc-bkp', lab: 'lab-w21-rtc-bkp', assessment: 'assessment-w21', sources: ['41', '42', '43'], project: 'w21-rtc-bkp' },
  { week: 22, suffix: 'w22', id: 'w22-reliability-storage', lab: 'lab-w22-reliability-storage', assessment: 'assessment-w22', sources: ['44', '45', '46', '47', '48', '49'], project: 'w22-pwr-wdg-flash' },
  { week: 23, suffix: 'w23', id: 'w23-capstone', lab: 'lab-w23-capstone', assessment: 'assessment-w23', sources: [], project: 'w23-capstone' },
  { week: 24, suffix: 'w24', id: 'w24-mastery-transfer', lab: 'lab-w24-final-practical', assessment: 'assessment-w24', sources: [], project: undefined },
] as const;
const HEADINGS = ['学完后能解释', '学完后能做到', '概念模型', 'CubeMX 为什么这样配', '最小实验', '调试与寄存器观察', '故障注入', '复述检查', '学习笔记', '资料来源'];
const CORE_TAGS = ['gpio.output-mode', 'exti.event-flow', 'nvic.priority', 'tim.timebase', 'adc.sampling', 'dma.transfer', 'usart.physical-frame', 'i2c.protocol', 'spi.protocol', 'rtc.time', 'pwr.low-power', 'wdg.recovery', 'flash.persistence'];
const EXTENSIONS = ['freertos', 'control', 'protocols', 'device-drivers', 'low-power', 'digital-logic-fpga-pla'];

async function text(path: string) { return readFile(join(ROOT, path), 'utf8'); }
async function json(path: string): Promise<any> { return JSON.parse(await text(path)); }
function parseIoc(body: string) {
  return new Map(body.split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}
function indexedValues(config: Map<string, string>, prefix: string) {
  return [...config.entries()].filter(([key]) => new RegExp(`^${prefix}\\d+$`).test(key)).map(([, value]) => value);
}
function totals(items: any[]) {
  return Object.fromEntries(['concept', 'configuration', 'practical', 'reflection'].map((kind) =>
    [kind, items.filter((item) => item.kind === kind).reduce((sum, item) => sum + item.maxScore, 0)]));
}

function findHostCompiler(): string {
  const candidates = [process.env.HOST_CC, 'clang', 'gcc', 'cc', 'tcc'].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    if ((candidate.includes('\\') || candidate.includes('/')) && !existsSync(candidate)) continue;
    const probe = spawnSync(candidate, /^tcc(?:\.exe)?$/i.test(basename(candidate)) ? ['-v'] : ['--version'], { encoding: 'utf8' });
    if (probe.status === 0) return candidate;
  }
  throw new Error('No host C compiler found. Install clang/gcc or set HOST_CC to its executable path.');
}

function compileAndRunHostBehavior(mutateHealth = false) {
  const compiler = findHostCompiler();
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'phase-06-host-'));
  const executable = join(temporaryDirectory, process.platform === 'win32' ? 'phase-06-host.exe' : 'phase-06-host');
  const includeDirectories = [
    'firmware/lessons/w21-rtc-bkp/App',
    'firmware/lessons/w22-pwr-wdg-flash/App',
    'firmware/lessons/w23-capstone/Sensors',
    'firmware/lessons/w23-capstone/Storage',
    'firmware/lessons/w23-capstone/Clock',
    'firmware/lessons/w23-capstone/Display',
    'firmware/lessons/w23-capstone/Health',
    'firmware/lessons/w23-capstone/App',
  ];
  const sources = [
    join(ROOT, 'scripts/content-validation/phase-06-host-behavior.c'),
    join(ROOT, 'firmware/lessons/w21-rtc-bkp/App/clock_logic.c'),
    join(ROOT, 'firmware/lessons/w22-pwr-wdg-flash/App/reliability_logic.c'),
    join(ROOT, 'firmware/lessons/w22-pwr-wdg-flash/App/flash_store.c'),
    join(ROOT, 'firmware/lessons/w23-capstone/Sensors/sensors.c'),
    join(ROOT, 'firmware/lessons/w23-capstone/Storage/storage.c'),
    join(ROOT, 'firmware/lessons/w23-capstone/Clock/clock.c'),
    join(ROOT, 'firmware/lessons/w23-capstone/Display/display.c'),
    join(ROOT, 'firmware/lessons/w23-capstone/Health/health.c'),
    join(ROOT, 'firmware/lessons/w23-capstone/App/app.c'),
  ];
  try {
    if (mutateHealth) {
      const index = sources.findIndex((source) => source.endsWith(join('Health', 'health.c')));
      const productionSource = readFileSync(sources[index], 'utf8');
      const mutation = productionSource.replace(
        'HEALTH_REQUIRED_MASK = HEALTH_PROGRESS_SAMPLE | HEALTH_PROGRESS_STORAGE | HEALTH_PROGRESS_DISPLAY',
        'HEALTH_REQUIRED_MASK = HEALTH_PROGRESS_SAMPLE',
      );
      expect(mutation).not.toBe(productionSource);
      const mutatedSource = join(temporaryDirectory, 'health.c');
      writeFileSync(mutatedSource, mutation, 'utf8');
      sources[index] = mutatedSource;
    }
    const flags = /^tcc(?:\.exe)?$/i.test(basename(compiler)) ? [] : ['-std=c11', '-Wall', '-Wextra', '-Werror'];
    const includes = includeDirectories.flatMap((directory) => ['-I', join(ROOT, directory)]);
    const compile = spawnSync(compiler, [...flags, ...includes, ...sources, '-o', executable], { encoding: 'utf8' });
    expect(compile.status, `${compile.stdout}\n${compile.stderr}`).toBe(0);
    return spawnSync(executable, [], { encoding: 'utf8' });
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

describe('phase 6 curriculum and evidence contract', () => {
  it('uses the exact week, lab, assessment, source and firmware identities', async () => {
    for (const spec of WEEKS) {
      const week = await json(`curriculum/weeks/${spec.suffix}.json`);
      const lab = await json(`labs/manifests/${spec.lab}.json`);
      const assessment = await json(`assessments/question-banks/${spec.assessment}.json`);
      expect(week).toMatchObject({ id: spec.id, week: spec.week, sourceCourseIds: spec.sources, labIds: [spec.lab], assessmentId: spec.assessment });
      expect(lab).toMatchObject({ id: spec.lab, lessonId: spec.id });
      expect(lab.firmwareProject).toBe(spec.project ? `firmware/lessons/${spec.project}` : undefined);
      expect(assessment).toMatchObject({ id: spec.assessment, lessonId: spec.id });
      expect(totals(assessment.items)).toEqual({ concept: 25, configuration: 25, practical: 35, reflection: 15 });
      const page = await text(`curriculum/weeks/${spec.suffix}.md`);
      expect(HEADINGS.filter((heading) => page.includes(`## ${heading}`))).toHaveLength(10);
      expect(page).toMatch(/访问日期：2026-07-20/);
      expect(page).toMatch(/待实机验证/);
    }
    for (const spec of WEEKS.filter((item) => item.project)) {
      expect((await stat(join(ROOT, 'firmware/lessons', spec.project!, `${spec.project}.ioc`))).isFile()).toBe(true);
      expect((await stat(join(ROOT, 'firmware/lessons', spec.project!, 'CMakeLists.txt'))).isFile()).toBe(true);
    }
    await expect(stat(join(ROOT, 'firmware/lessons/w24-mastery-transfer'))).rejects.toThrow();
  });

  it('teaches the required reliability and capstone boundaries without claiming physical completion', async () => {
    const pages = await Promise.all(WEEKS.map((spec) => text(`curriculum/weeks/${spec.suffix}.md`)));
    expect(pages[0]).toMatch(/LSE/); expect(pages[0]).toMatch(/VBAT/); expect(pages[0]).toMatch(/32767/); expect(pages[0]).toMatch(/BKP/); expect(pages[0]).toMatch(/high-low-high|高.*低.*高/is); expect(pages[0]).toMatch(/UTC/);
    expect(pages[1]).toMatch(/Sleep/); expect(pages[1]).toMatch(/Stop/); expect(pages[1]).toMatch(/Standby/); expect(pages[1]).toMatch(/SystemClock_Config/); expect(pages[1]).toMatch(/IWDG/); expect(pages[1]).toMatch(/WWDG/); expect(pages[1]).toMatch(/0x0800FC00/); expect(pages[1]).toMatch(/mass erase|全片擦除/i); expect(pages[1]).toMatch(/option bytes|选项字节/i);
    expect(pages[2]).toMatch(/Sensors/); expect(pages[2]).toMatch(/Storage/); expect(pages[2]).toMatch(/Clock/); expect(pages[2]).toMatch(/Display/); expect(pages[2]).toMatch(/Health/); expect(pages[2]).toMatch(/magic/); expect(pages[2]).toMatch(/version/); expect(pages[2]).toMatch(/length/); expect(pages[2]).toMatch(/checksum/); expect(pages[2]).toMatch(/0x0800F800/); expect(pages[2]).toMatch(/损坏.*跳过|跳过.*损坏/s);
    expect(pages[3]).toMatch(/phase average.*75|阶段平均.*75/i); expect(pages[3]).toMatch(/每.*tag.*70|每个.*标签.*70/i); expect(pages[3]).toMatch(/practical.*70|实践.*70/i); expect(pages[3]).toMatch(/evidence bundle|证据包/i); expect(pages[3]).toMatch(/pending physical|待实机/s);
    for (const spec of WEEKS) {
      const records = [await json(`curriculum/weeks/${spec.suffix}.json`), await json(`labs/manifests/${spec.lab}.json`)];
      for (const record of records) {
        expect(record.detectionChecks.map((check: any) => check.mode).sort()).toEqual(['automatic', 'manual', 'semi-automatic']);
        const physical = record.detectionChecks.filter((check: any) => check.physicalHardware);
        expect(JSON.stringify(physical)).toMatch(/待实机验证/);
      }
    }
  });

  it('locks gate 06 to all core tags and explicit score and evidence thresholds', async () => {
    const gate = await json('assessments/practicals/gate-06.json');
    expect(gate).toMatchObject({ id: 'gate-06', phase: 6, lessonIds: WEEKS.map((spec) => spec.id) });
    expect(gate.requiredTagIds).toEqual(CORE_TAGS);
    expect(totals(gate.items)).toEqual({ concept: 25, configuration: 25, practical: 35, reflection: 15 });
    const body = JSON.stringify(gate);
    expect(body).toMatch(/75/); expect(body).toMatch(/每.*(?:tag|标签).*70/i); expect(body).toMatch(/实践.*70|practical.*70/i); expect(body).toMatch(/证据包|evidence bundle/i); expect(body).toMatch(/待实机验证|pending physical/i);
  });

  it('provides six honest tag-gated extension bridges', async () => {
    for (const name of EXTENSIONS) {
      const page = await text(`curriculum/extensions/${name}.md`);
      for (const heading of ['进入条件', '为什么适合继续学习', '起步项目', '尚未掌握', '权威资料']) expect(page).toContain(`## ${heading}`);
      expect(page).toMatch(/mastered tags|已掌握标签/i);
      expect(page).toMatch(/https:\/\//);
    }
    const fpga = await text('curriculum/extensions/digital-logic-fpga-pla.md');
    expect(fpga).toMatch(/组合逻辑/); expect(fpga).toMatch(/时序逻辑/); expect(fpga).toMatch(/Verilog/); expect(fpga).toMatch(/FPGA.*引脚|引脚.*FPGA/s); expect(fpga).toMatch(/PLA.*乘积项|乘积项.*PLA/s); expect(fpga).toMatch(/不等价|不能等同/);
  });
});

describe('phase 6 generated firmware and production behavior', () => {
  it('executes the production modules in a portable host C test', () => {
    const execute = compileAndRunHostBehavior();
    expect(execute.status, `${execute.stdout}\n${execute.stderr}`).toBe(0);
    expect(execute.stdout).toContain('phase-06 host behavior: PASS');
  });

  it('rejects a compiled watchdog progress mutation at runtime', () => {
    const execute = compileAndRunHostBehavior(true);
    expect(execute.status).not.toBe(0);
    expect(execute.stderr).toContain('Health_TakeFeedPermission(&health) == 0U');
  });

  it('keeps RTC backup-domain initialization and Unix counter reads explicit', async () => {
    const ioc = await text('firmware/lessons/w21-rtc-bkp/w21-rtc-bkp.ioc');
    const rtc = await text('firmware/lessons/w21-rtc-bkp/Core/Src/rtc.c');
    const app = await text('firmware/lessons/w21-rtc-bkp/App/app.c');
    const logic = await text('firmware/lessons/w21-rtc-bkp/App/clock_logic.c');
    expect(ioc).toMatch(/RCC\.RTCClockSelection=RCC_RTCCLKSOURCE_LSE/); expect(ioc).toMatch(/RTC\.AsynchPrediv=32767/);
    expect(rtc).toMatch(/AsynchPrediv\s*=\s*32767/);
    expect(app).toMatch(/HAL_RTCEx_BKUPRead/); expect(app).toMatch(/HAL_RTCEx_BKUPWrite/); expect(app).not.toMatch(/BackupReset|Force.*Backup|BDRST/i);
    expect(logic).toMatch(/CLOCK_BACKUP_MARKER/); expect(logic).toMatch(/high.*low.*high/s);
    expect(app).toMatch(/Clock_WriteUnixUtc\([^)]*\)\s*!=\s*0/);
    expect(app.match(/Clock_WaitForWriteComplete\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps every CubeMX configuration internally consistent with generated init code', async () => {
    const specs = [
      { name: 'w21-rtc-bkp', requiredIps: ['NVIC', 'RCC', 'RTC', 'SYS'], forbiddenIps: ['ADC1'], requiredPins: ['PC14-OSC32_IN', 'PC15-OSC32_OUT'], requiredInits: ['MX_RTC_Init'] },
      { name: 'w22-pwr-wdg-flash', requiredIps: ['IWDG', 'NVIC', 'RCC', 'SYS'], forbiddenIps: ['ADC1', 'WWDG'], requiredPins: ['PA0-WKUP'], requiredInits: ['MX_IWDG_Init'] },
      { name: 'w23-capstone', requiredIps: ['ADC1', 'I2C1', 'NVIC', 'RCC', 'RTC', 'SPI2', 'SYS', 'USART1'], forbiddenIps: ['USART2'], requiredPins: ['PA0-WKUP', 'PA1', 'PA9', 'PA10', 'PB6', 'PB7', 'PB12', 'PB13', 'PB14', 'PB15', 'PC14-OSC32_IN', 'PC15-OSC32_OUT'], requiredInits: ['MX_ADC1_Init', 'MX_I2C1_Init', 'MX_RTC_Init', 'MX_SPI2_Init', 'MX_USART1_UART_Init'] },
    ];
    for (const spec of specs) {
      const config = parseIoc(await text(`firmware/lessons/${spec.name}/${spec.name}.ioc`));
      const ips = indexedValues(config, 'Mcu\\.IP');
      const pins = indexedValues(config, 'Mcu\\.Pin');
      expect(Number(config.get('Mcu.IPNb'))).toBe(ips.length);
      expect(Number(config.get('Mcu.PinsNb'))).toBe(pins.length);
      for (const ip of spec.requiredIps) expect(ips).toContain(ip);
      for (const ip of spec.forbiddenIps) expect(ips).not.toContain(ip);
      for (const pin of spec.requiredPins) expect(pins).toContain(pin);
      const functionList = config.get('ProjectManager.functionlistsort') ?? '';
      const main = await text(`firmware/lessons/${spec.name}/Core/Src/main.c`);
      const application = await text(`firmware/lessons/${spec.name}/App/app.c`);
      for (const init of spec.requiredInits) {
        expect(functionList).toContain(init);
        expect(`${main}\n${application}`).toContain(`${init}();`);
      }
      if (spec.name === 'w22-pwr-wdg-flash') expect(main).not.toContain('MX_IWDG_Init();');
    }
    const capstone = parseIoc(await text('firmware/lessons/w23-capstone/w23-capstone.ioc'));
    expect(capstone.get('ADC1.NbrOfConversion')).toBe('2');
    expect([...capstone.keys()].some((key) => key.startsWith('ADC1.Rank-2'))).toBe(false);
    expect(indexedValues(capstone, 'Mcu\\.Pin')).not.toContain('PA2');
    expect(capstone.get('PA9.Signal')).toBe('USART1_TX');
    expect(capstone.get('PA10.Signal')).toBe('USART1_RX');
  });

  it('reserves one internal flash page and handles reset, power and watchdog state safely', async () => {
    const linker = await text('firmware/lessons/w22-pwr-wdg-flash/STM32F103xx_FLASH.ld');
    const app = await text('firmware/lessons/w22-pwr-wdg-flash/App/app.c');
    const flash = await text('firmware/lessons/w22-pwr-wdg-flash/App/flash_store.c');
    expect(linker).toMatch(/FLASH\s*\(rx\).*LENGTH\s*=\s*63K/);
    expect(app.indexOf('CaptureResetFlags')).toBeLessThan(app.indexOf('__HAL_RCC_CLEAR_RESET_FLAGS'));
    expect(app).toMatch(/HAL_PWR_EnterSLEEPMode/); expect(app).toMatch(/HAL_PWR_EnterSTOPMode/); expect(app).toMatch(/SystemClock_Config/); expect(app).toMatch(/HAL_PWR_EnterSTANDBYMode/); expect(app).toMatch(/PWR_FLAG_SB/); expect(app).toMatch(/PWR_FLAG_WU/);
    expect(app).toMatch(/HAL_IWDG_Refresh/); expect(app).not.toMatch(/HAL_WWDG_Refresh/);
    expect(app).toMatch(/App_ReportExternalProgress/); expect(app).toMatch(/MX_IWDG_Init/);
    expect(app).not.toMatch(/RunWatchdogDemoOnce[\s\S]*ReliabilityLogic_ReportProgress/);
    expect(flash).toMatch(/0x0800FC00/); expect(flash).toMatch(/FLASH_TYPEERASE_PAGES/); expect(flash).not.toMatch(/MASSERASE|OB_/); expect(flash).toMatch(/HAL_FLASH_Lock/); expect(flash).toMatch(/restore|Restore/); expect(flash).toMatch(/readback|Readback/);
  });

  it('links all six capstone modules into a nonblocking application with separate settings', async () => {
    const cmake = await text('firmware/lessons/w23-capstone/CMakeLists.txt');
    const linker = await text('firmware/lessons/w23-capstone/STM32F103xx_FLASH.ld');
    const app = await text('firmware/lessons/w23-capstone/App/app.c');
    const health = await text('firmware/lessons/w23-capstone/Health/health.c');
    const storage = await text('firmware/lessons/w23-capstone/Storage/storage.c');
    for (const module of ['Sensors/sensors.c', 'Storage/storage.c', 'Clock/clock.c', 'Display/display.c', 'Health/health.c', 'App/app.c']) expect(cmake).toContain(module);
    expect(linker).toMatch(/FLASH\s*\(rx\).*LENGTH\s*=\s*62K/);
    expect(app).not.toMatch(/HAL_Delay|osDelay|vTaskDelay/); expect(app).toMatch(/CAPSTONE_STATE_SAMPLE/); expect(app).toMatch(/CAPSTONE_STATE_STORE/); expect(app).toMatch(/CAPSTONE_STATE_DISPLAY/);
    expect(health).toMatch(/HEALTH_PROGRESS_SAMPLE.*HEALTH_PROGRESS_STORAGE.*HEALTH_PROGRESS_DISPLAY/s);
    expect(storage).toMatch(/STORAGE_RECORD_MAGIC/); expect(storage).toMatch(/STORAGE_RECORD_VERSION/); expect(storage).toMatch(/checksum/i); expect(storage).toMatch(/length/i);
    expect(await text('firmware/lessons/w23-capstone/App/app_hal.c')).toMatch(/0x0800F800/);
  });

  it('wires the capstone to real peripheral adapters instead of memory-only stubs', async () => {
    const cmake = await text('firmware/lessons/w23-capstone/CMakeLists.txt');
    const sensorsHal = await text('firmware/lessons/w23-capstone/Sensors/sensors_hal.c');
    const storageBus = await text('firmware/lessons/w23-capstone/Storage/storage_w25q64.c');
    const clockHal = await text('firmware/lessons/w23-capstone/Clock/clock_hal.c');
    const displayHal = await text('firmware/lessons/w23-capstone/Display/display_hal.c');
    const appHal = await text('firmware/lessons/w23-capstone/App/app_hal.c');
    for (const adapter of ['Sensors/sensors_hal.c', 'Storage/storage_w25q64.c', 'Clock/clock_hal.c', 'Display/display_hal.c', 'App/app_hal.c']) expect(cmake).toContain(adapter);
    expect(sensorsHal).toMatch(/HAL_I2C_Mem_Read/);
    expect(sensorsHal).toMatch(/HAL_ADC_Start/);
    expect(storageBus).toMatch(/W25Q64_CMD_READ_DATA/);
    expect(storageBus).toMatch(/W25Q64_CMD_PAGE_PROGRAM/);
    expect(storageBus).toMatch(/W25Q64_CMD_SECTOR_ERASE/);
    expect(storageBus).toMatch(/HAL_SPI_Transmit/);
    expect(clockHal).toMatch(/HAL_RTC/);
    expect(displayHal).toMatch(/HAL_UART_Transmit/);
    expect(appHal).toMatch(/SensorsHal_Sample/);
    expect(appHal).toMatch(/StorageW25Q64_Append/);
    expect(appHal).toMatch(/ClockHal_UnixUtc/);
    expect(appHal).toMatch(/DisplayHal_Render/);
    expect(sensorsHal).toMatch(/MPU6050_PWR_MGMT_1/);
    expect(sensorsHal).toMatch(/MPU6050_WHO_AM_I/);
    expect(sensorsHal).toMatch(/0x68U/);
    expect(storageBus).toMatch(/W25Q64_LOG_BASE/);
    expect(storageBus).toMatch(/W25Q64_LOG_LIMIT/);
    expect(storageBus).toMatch(/W25Q64_JEDEC_ID.*0xEF4017/s);
    expect(storageBus).toMatch(/W25Q64_STATUS_WEL/);
  });
});
