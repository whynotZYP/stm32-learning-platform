import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const WEEKS = [
  { week: 13, suffix: 'w13', id: 'w13-dma', lab: 'lab-w13-dma', assessment: 'assessment-w13', sources: ['23', '24'], project: 'w13-adc-dma', tag: 'dma.transfer' },
  { week: 14, suffix: 'w14', id: 'w14-usart', lab: 'lab-w14-usart', assessment: 'assessment-w14', sources: ['25', '26', '27'], project: 'w14-usart', tag: 'usart.physical-frame' },
  { week: 15, suffix: 'w15', id: 'w15-usart-packets', lab: 'lab-w15-usart-packets', assessment: 'assessment-w15', sources: ['28', '29', '30'], project: 'w15-usart-packets', tag: 'usart.packet' },
  { week: 16, suffix: 'w16', id: 'w16-i2c-basics', lab: 'lab-w16-i2c-basics', assessment: 'assessment-w16', sources: ['31', '32'], project: 'w16-i2c-mpu6050-id', tag: 'i2c.protocol' },
] as const;
const HEADINGS = ['学完后能解释', '学完后能做到', '概念模型', 'CubeMX 为什么这样配', '最小实验', '调试与寄存器观察', '故障注入', '复述检查', '学习笔记', '资料来源'];

async function text(path: string) { return readFile(join(ROOT, path), 'utf8'); }
async function json(path: string): Promise<any> { return JSON.parse(await text(path)); }
function totals(items: any[]) {
  return Object.fromEntries(['concept', 'configuration', 'practical', 'reflection'].map((kind) =>
    [kind, items.filter((item) => item.kind === kind).reduce((sum, item) => sum + item.maxScore, 0)]));
}
function verifyDetectionChecks(record: any, coreTag: boolean) {
  expect(record.detectionChecks.map((item: any) => item.mode).sort()).toEqual(['automatic', 'manual', 'semi-automatic']);
  for (const check of record.detectionChecks) {
    if (!check.applicable) expect(check.reason?.trim()).not.toBe('');
    if (check.evidenceSource === 'simulator') expect(check.physicalHardware).toBe(false);
  }
  if (coreTag) {
    expect(record.detectionChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({ mode: 'semi-automatic', applicable: true, evidenceSource: 'device', physicalHardware: true }),
      expect.objectContaining({ mode: 'manual', applicable: true, evidenceSource: 'manual', physicalHardware: true }),
    ]));
  }
}

describe('phase 4 curriculum contract', () => {
  it('uses exact week IDs, sources, labs, assessments and complete firmware project paths', async () => {
    for (const spec of WEEKS) {
      const week = await json(`curriculum/weeks/${spec.suffix}.json`);
      const page = await text(`curriculum/weeks/${spec.suffix}.md`);
      const lab = await json(`labs/manifests/${spec.lab}.json`);
      const assessment = await json(`assessments/question-banks/${spec.assessment}.json`);
      expect(week).toMatchObject({ id: spec.id, week: spec.week, sourceCourseIds: spec.sources, targetTagIds: [spec.tag], labIds: [spec.lab], assessmentId: spec.assessment });
      expect(page.trim().length).toBeGreaterThan(1200);
      expect(page.match(/^##\s+.+$/gm)?.map((heading) => heading.replace(/^##\s+/, ''))).toEqual(HEADINGS);
      expect(page).toMatch(/https:\/\/.*st\.com/i);
      expect(page).toMatch(/访问日期[：:]\s*2026-07-20/);
      expect(lab).toMatchObject({ id: spec.lab, lessonId: spec.id, firmwareProject: `firmware/lessons/${spec.project}` });
      expect(assessment).toMatchObject({ id: spec.assessment, lessonId: spec.id });
      expect(totals(assessment.items)).toEqual({ concept: 25, configuration: 25, practical: 35, reflection: 15 });
      verifyDetectionChecks(week, spec.tag !== 'usart.packet');
      verifyDetectionChecks(lab, spec.tag !== 'usart.packet');
      for (const entry of [`${spec.project}.ioc`, 'CMakeLists.txt', 'CMakePresets.json', 'Core/Src/main.c', 'Core/Src/stm32f1xx_it.c', 'App/app.c', 'App/app.h']) {
        expect((await stat(join(ROOT, 'firmware/lessons', spec.project, entry))).isFile()).toBe(true);
      }
    }
    const gate = await json('assessments/practicals/gate-04.json');
    expect(gate).toMatchObject({ id: 'gate-04', phase: 4, lessonIds: WEEKS.map((item) => item.id) });
    expect(totals(gate.items)).toEqual({ concept: 25, configuration: 25, practical: 35, reflection: 15 });
  });

  it('teaches DMA, USART frames, bounded packets and I2C with explicit faults and safety', async () => {
    const pages = await Promise.all(WEEKS.map((item) => text(`curriculum/weeks/${item.suffix}.md`)));
    expect(pages[0]).toMatch(/请求|request/i); expect(pages[0]).toMatch(/方向/); expect(pages[0]).toMatch(/宽度|对齐/); expect(pages[0]).toMatch(/计数/); expect(pages[0]).toMatch(/循环|circular/i); expect(pages[0]).toMatch(/四通道|4\s*通道/); expect(pages[0]).toMatch(/半更新|稳定快照/);
    expect(pages[1]).toMatch(/串行.*并行|并行.*串行/s); expect(pages[1]).toMatch(/单工.*双工|双工.*单工/s); expect(pages[1]).toMatch(/起始位/); expect(pages[1]).toMatch(/停止位/); expect(pages[1]).toMatch(/115200/); expect(pages[1]).toMatch(/8N1/); expect(pages[1]).toMatch(/TTL/); expect(pages[1]).toMatch(/CH340/); expect(pages[1]).toMatch(/3\.3\s*V/); expect(pages[1]).toMatch(/共地/); expect(pages[1]).toMatch(/PA9/); expect(pages[1]).toMatch(/PA10/); expect(pages[1]).toMatch(/ORE/);
    expect(pages[2]).toMatch(/文本.*HEX|HEX.*文本/s); expect(pages[2]).toMatch(/帧边界/); expect(pages[2]).toMatch(/长度/); expect(pages[2]).toMatch(/校验/); expect(pages[2]).toMatch(/超时/); expect(pages[2]).toMatch(/状态机/); expect(pages[2]).toMatch(/Bootloader|引导加载/i); expect(pages[2]).toMatch(/丢字节/); expect(pages[2]).toMatch(/粘包|连续帧/); expect(pages[2]).toMatch(/超长/);
    expect(pages[3]).toMatch(/开漏/); expect(pages[3]).toMatch(/上拉/); expect(pages[3]).toMatch(/START/); expect(pages[3]).toMatch(/STOP/); expect(pages[3]).toMatch(/ACK/); expect(pages[3]).toMatch(/NACK/); expect(pages[3]).toMatch(/0x68\s*<<\s*1/); expect(pages[3]).toMatch(/0x75/); expect(pages[3]).toMatch(/WHO_AM_I/); expect(pages[3]).toMatch(/外部.*3\.3\s*V.*上拉/s); expect(pages[3]).toMatch(/100\s*kHz/i);
    const gate = JSON.stringify(await json('assessments/practicals/gate-04.json'));
    expect(gate).toMatch(/CPU.*DMA|DMA.*CPU/s); expect(gate).toMatch(/损坏|校验/); expect(gate).toMatch(/START.*STOP/s);
  });
});

describe('phase 4 generated firmware contracts', () => {
  it('configures ADC1 DMA1 Channel1 circular scans and a separate memory DMA transfer', async () => {
    const ioc = await text('firmware/lessons/w13-adc-dma/w13-adc-dma.ioc');
    const dma = await text('firmware/lessons/w13-adc-dma/Core/Src/dma.c');
    const adc = await text('firmware/lessons/w13-adc-dma/Core/Src/adc.c');
    const app = await text('firmware/lessons/w13-adc-dma/App/app.c');
    expect(ioc).toMatch(/DMA1_Channel1/); expect(ioc).toMatch(/DMA_CIRCULAR/); expect(ioc).toMatch(/DMA_PDATAALIGN_HALFWORD/); expect(ioc).toMatch(/DMA_MDATAALIGN_HALFWORD/); expect(adc).toMatch(/ADC_SCAN_ENABLE/); expect(adc).toMatch(/NbrOfConversion\s*=\s*4/); expect(adc).toMatch(/DMA1_Channel1/); expect(dma).toMatch(/MX_DMA_Init/); expect(app).toMatch(/DMA1_Channel2/); expect(app).toMatch(/DMA_MEMORY_TO_MEMORY/); expect(app).toMatch(/HAL_DMA_Start/); expect(app).toMatch(/HAL_DMA_PollForTransfer\s*\([^,]+,[^,]+,\s*10U\s*\)/s); expect(app).toMatch(/HAL_ADC_Start_DMA/); expect(app).toMatch(/HAL_ADC_ConvHalfCpltCallback/); expect(app).toMatch(/HAL_ADC_ConvCpltCallback/);
  });

  it('configures USART1 115200 8N1 and bounded IRQ recovery without printf in IRQ', async () => {
    for (const project of ['w14-usart', 'w15-usart-packets']) {
      const ioc = await text(`firmware/lessons/${project}/${project}.ioc`);
      const uart = await text(`firmware/lessons/${project}/Core/Src/usart.c`);
      const irq = await text(`firmware/lessons/${project}/Core/Src/stm32f1xx_it.c`);
      const app = await text(`firmware/lessons/${project}/App/app.c`);
      expect(ioc).toMatch(/PA9\.Signal=USART1_TX/); expect(ioc).toMatch(/PA10\.Signal=USART1_RX/); expect(uart).toMatch(/BaudRate\s*=\s*115200/); expect(uart).toMatch(/UART_WORDLENGTH_8B/); expect(uart).toMatch(/UART_STOPBITS_1/); expect(uart).toMatch(/UART_PARITY_NONE/); expect(app).toMatch(/HAL_UART_Receive_IT/); expect(app).toMatch(/HAL_UART_Receive_IT[\s\S]*!=\s*HAL_OK[\s\S]*rearm_failure_count\s*=\s*rearm_failure_count\s*\+\s*1U/); expect(app).toMatch(/App_GetRxRearmFailureCount/); expect(app).toMatch(/HAL_UART_ErrorCallback/); expect(app).toMatch(/HAL_UART_ERROR_ORE/); expect(app).toMatch(/__HAL_UART_CLEAR_OREFLAG/); expect(irq).not.toMatch(/printf|HAL_UART_Transmit/);
    }
    expect(await text('firmware/lessons/w14-usart/App/app.c')).toMatch(/HAL_UART_Transmit\s*\([^,]+,[^,]+,[^,]+,\s*20U\s*\)/s);
  });

  it('keeps packet parsing out of the ISR and bounds parser storage and time', async () => {
    const app = await text('firmware/lessons/w15-usart-packets/App/app.c');
    const parser = await text('firmware/lessons/w15-usart-packets/App/packet_parser.c');
    const irq = await text('firmware/lessons/w15-usart-packets/Core/Src/stm32f1xx_it.c');
    expect(app).toMatch(/UsartRx_Pop/); expect(app).toMatch(/PacketParser_Push/); expect(parser).toMatch(/PACKET_MAX_PAYLOAD/); expect(parser).toMatch(/PACKET_TIMEOUT_MS/); expect(irq).not.toMatch(/PacketParser|printf|HAL_UART_Transmit/);
  });

  it('configures I2C1 open-drain at 100 kHz and performs only a bounded WHO_AM_I read', async () => {
    const ioc = await text('firmware/lessons/w16-i2c-mpu6050-id/w16-i2c-mpu6050-id.ioc');
    const i2c = await text('firmware/lessons/w16-i2c-mpu6050-id/Core/Src/i2c.c');
    const app = await text('firmware/lessons/w16-i2c-mpu6050-id/App/app.c');
    expect(ioc).toMatch(/PB6\.Signal=I2C1_SCL/); expect(ioc).toMatch(/PB7\.Signal=I2C1_SDA/); expect(i2c).toMatch(/ClockSpeed\s*=\s*100000/); expect(i2c).toMatch(/GPIO_MODE_AF_OD/); expect(app).toMatch(/HAL_I2C_Mem_Read\s*\([^,]+,\s*MPU6050_HAL_ADDRESS,\s*MPU6050_WHO_AM_I_REGISTER,\s*I2C_MEMADD_SIZE_8BIT,[\s\S]*?20U\s*\)/); expect(app).not.toMatch(/ACCEL|GYRO|PWR_MGMT/);
  });
});
