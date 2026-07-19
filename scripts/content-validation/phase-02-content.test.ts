import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

const WEEKS = [
  { week: 5, suffix: 'w05', id: 'w05-gpio-input', lab: 'lab-w05-gpio-input', assessment: 'assessment-w05', sources: ['07', '08'], project: 'w05-gpio-input' },
  { week: 6, suffix: 'w06', id: 'w06-oled-debug', lab: 'lab-w06-oled-debug', assessment: 'assessment-w06', sources: ['09', '10'], project: 'w06-oled-debug' },
  { week: 7, suffix: 'w07', id: 'w07-exti-events', lab: 'lab-w07-exti-events', assessment: 'assessment-w07', sources: ['11', '12'], project: 'w07-exti-events' },
  { week: 8, suffix: 'w08', id: 'w08-tim-timebase', lab: 'lab-w08-tim-timebase', assessment: 'assessment-w08', sources: ['13', '14'], project: 'w08-tim-timebase' },
] as const;

async function text(path: string) { return readFile(join(ROOT, path), 'utf8'); }
async function json(path: string): Promise<any> { return JSON.parse(await text(path)); }
function totals(items: any[]) {
  return Object.fromEntries(['concept', 'configuration', 'practical', 'reflection'].map((kind) =>
    [kind, items.filter((item) => item.kind === kind).reduce((sum, item) => sum + item.maxScore, 0)]));
}
function checks(record: any) {
  expect(record.detectionChecks.map((item: any) => item.mode).sort()).toEqual(['automatic', 'manual', 'semi-automatic']);
  for (const item of record.detectionChecks) {
    if (!item.applicable) expect(item.reason.trim()).not.toBe('');
    if (item.evidenceSource === 'simulator') expect(item.physicalHardware).toBe(false);
  }
}

describe('phase 2 curriculum contract', () => {
  it('creates exact week, source, lab, assessment and firmware relationships', async () => {
    for (const spec of WEEKS) {
      const week = await json(`curriculum/weeks/${spec.suffix}.json`);
      const lab = await json(`labs/manifests/${spec.lab}.json`);
      const assessment = await json(`assessments/question-banks/${spec.assessment}.json`);
      expect(week).toMatchObject({ id: spec.id, week: spec.week, sourceCourseIds: spec.sources, labIds: [spec.lab], assessmentId: spec.assessment });
      expect((await text(`curriculum/weeks/${spec.suffix}.md`)).trim().length).toBeGreaterThan(1200);
      expect(lab).toMatchObject({ id: spec.lab, lessonId: spec.id, firmwareProject: `firmware/lessons/${spec.project}` });
      expect(assessment).toMatchObject({ id: spec.assessment, lessonId: spec.id });
      expect(totals(assessment.items)).toEqual({ concept: 25, configuration: 25, practical: 35, reflection: 15 });
      checks(week); checks(lab);
      for (const entry of [`${spec.project}.ioc`, 'CMakeLists.txt', 'CMakePresets.json', 'Core/Src/main.c', 'Core/Src/stm32f1xx_it.c', 'App/app.c', 'App/app.h']) {
        expect((await stat(join(ROOT, 'firmware/lessons', spec.project, entry))).isFile()).toBe(true);
      }
    }
    const gate = await json('assessments/practicals/gate-02.json');
    expect(gate).toMatchObject({ id: 'gate-02', phase: 2, lessonIds: WEEKS.map((item) => item.id) });
    expect(totals(gate.items)).toEqual({ concept: 25, configuration: 25, practical: 35, reflection: 15 });
  });

  it('teaches the required failure analysis, safety, observations and gate evidence', async () => {
    const pages = await Promise.all(WEEKS.map((item) => text(`curriculum/weeks/${item.suffix}.md`)));
    const w05Lab = JSON.stringify(await json('labs/manifests/lab-w05-gpio-input.json'));
    const w07Lab = JSON.stringify(await json('labs/manifests/lab-w07-exti-events.json'));
    expect(pages[0]).toMatch(/浮空|上拉|下拉/); expect(pages[0]).toMatch(/低有效|抖动|轮询/); expect(pages[0]).toMatch(/IDR/);
    expect(pages[0]).toMatch(/连续稳定.{0,12}20\s*ms/s); expect(pages[0]).not.toMatch(/每\s*5\s*ms.{0,20}连续四次/s);
    expect(pages[0]).toMatch(/PA1.{0,40}(?:高有效|active-high)/s); expect(w05Lab).toMatch(/PA1.{0,80}(?:高有效|active-high)/s); expect(w05Lab).toMatch(/PB1.{0,80}蜂鸣器/s);
    expect(pages[1]).toMatch(/OLED/); expect(pages[1]).toMatch(/像素|页/); expect(pages[1]).toMatch(/I2C.*SPI|SPI.*I2C/s); expect(pages[1]).toMatch(/0x3C/); expect(pages[1]).toMatch(/SCL.*SDA|SDA.*SCL/s);
    expect(pages[2]).toMatch(/EXTI/); expect(pages[2]).toMatch(/挂起|pending|PR/); expect(pages[2]).toMatch(/优先级|NVIC/); expect(pages[2]).toMatch(/中断风暴/);
    expect(pages[2]).toMatch(/PA0.{0,80}(?:高有效|active-high).{0,80}上升沿/s); expect(pages[2]).not.toMatch(/红外模块或按键/); expect(w07Lab).not.toMatch(/红外模块或按键/);
    expect(pages[3]).toMatch(/PSC/); expect(pages[3]).toMatch(/ARR/); expect(pages[3]).toMatch(/CNT/); expect(pages[3]).toMatch(/UIF/); expect(pages[3]).toMatch(/TIM2/); expect(pages[3]).toMatch(/TIM3/);
    for (const page of pages) { expect(page).toMatch(/3\.3\s*V/); expect(page).toMatch(/断电/); expect(page).toMatch(/共地/); expect(page).toMatch(/https:\/\/.*st\.com/i); }
    const gate = JSON.stringify(await json('assessments/practicals/gate-02.json'));
    expect(gate).toMatch(/非阻塞|不阻塞|不使用阻塞/); expect(gate).toMatch(/OLED|串口/); expect(gate).toMatch(/优先级/); expect(gate).toMatch(/挂起|pending/);
  });
});

describe('phase 2 firmware boundaries', () => {
  it('keeps the timer ISR counter monotonic across main-loop reads', async () => {
    const app = await text('firmware/lessons/w08-tim-timebase/App/app.c');
    const appRun = app.slice(app.indexOf('void App_Run'), app.indexOf('uint16_t App_ExternalPulseCount'));
    expect(app).toMatch(/volatile\s+uint32_t\s+elapsed_seconds/);
    expect(app).toMatch(/uint32_t\s+last_reported_seconds/);
    expect(app).toMatch(/observed_seconds\s*=\s*elapsed_seconds/);
    expect(appRun).not.toMatch(/\belapsed_seconds\s*=\s*0U/);
  });

  it('uses documented safe pins and builds event, display and timebase boundaries', async () => {
    const w05 = await text('firmware/lessons/w05-gpio-input/Core/Inc/main.h');
    const w05Ioc = await text('firmware/lessons/w05-gpio-input/w05-gpio-input.ioc');
    const w05Gpio = await text('firmware/lessons/w05-gpio-input/Core/Src/gpio.c');
    const w05App = await text('firmware/lessons/w05-gpio-input/App/app.c');
    const w06Gpio = await text('firmware/lessons/w06-oled-debug/Core/Src/gpio.c');
    const w06Ioc = await text('firmware/lessons/w06-oled-debug/w06-oled-debug.ioc');
    const w06App = await text('firmware/lessons/w06-oled-debug/App/app.c');
    const w06Display = await text('firmware/lessons/w06-oled-debug/App/Display/display.h');
    const w06DisplaySource = await text('firmware/lessons/w06-oled-debug/App/Display/display.c');
    const w07It = await text('firmware/lessons/w07-exti-events/Core/Src/stm32f1xx_it.c');
    const w07Ioc = await text('firmware/lessons/w07-exti-events/w07-exti-events.ioc');
    const w07Gpio = await text('firmware/lessons/w07-exti-events/Core/Src/gpio.c');
    const w07App = await text('firmware/lessons/w07-exti-events/App/app.c');
    const w08Main = await text('firmware/lessons/w08-tim-timebase/Core/Src/main.c');
    const w08Tim = await text('firmware/lessons/w08-tim-timebase/Core/Src/tim.c');
    const w08Ioc = await text('firmware/lessons/w08-tim-timebase/w08-tim-timebase.ioc');
    const w08It = await text('firmware/lessons/w08-tim-timebase/Core/Src/stm32f1xx_it.c');
    const w08App = await text('firmware/lessons/w08-tim-timebase/App/app.c');
    expect(w05).toMatch(/BUTTON_Pin/); expect(w05).toMatch(/SENSOR_Pin/); expect(w05).toMatch(/BUZZER_Pin\s+GPIO_PIN_1/);
    expect(w05App).toMatch(/HAL_GPIO_ReadPin\s*\(\s*SENSOR_GPIO_Port\s*,\s*SENSOR_Pin\s*\)/); expect(w05App).toMatch(/HAL_GPIO_WritePin\s*\(\s*BUZZER_GPIO_Port\s*,\s*BUZZER_Pin/);
    expect(w05App).toMatch(/HAL_GetTick\s*\(\s*\)/); expect(w05App).toMatch(/DEBOUNCE_MS\s*=\s*20U/); expect(w05App).not.toMatch(/HAL_Delay/);
    expect(w05App).toMatch(/SENSOR_ACTIVE_STATE\s*=\s*GPIO_PIN_SET/); expect(w05Ioc).toMatch(/PA1\.GPIO_Mode=GPIO_MODE_INPUT/); expect(w05Ioc).toMatch(/PA1\.GPIO_PuPd=GPIO_PULLDOWN/); expect(w05Gpio).toMatch(/SENSOR_Pin[\s\S]*GPIO_PULLDOWN/);
    expect(w06Ioc).toMatch(/PB6\.GPIO_Mode=GPIO_MODE_OUTPUT_OD/); expect(w06Ioc).toMatch(/PB7\.GPIO_Mode=GPIO_MODE_OUTPUT_OD/);
    expect(w06Ioc).toMatch(/PB6\.GPIO_ModeDefaultOutputPP=GPIO_MODE_OUTPUT_OD/); expect(w06Ioc).toMatch(/PB7\.GPIO_ModeDefaultOutputPP=GPIO_MODE_OUTPUT_OD/);
    expect(w06Gpio).toMatch(/GPIO_MODE_OUTPUT_OD/); expect(w06Gpio).toMatch(/OLED_SCL_Pin/); expect(w06Gpio).toMatch(/OLED_SDA_Pin/);
    expect(w06Display).toMatch(/Display_Init\s*\(\s*void\s*\)/); expect(w06Display).toMatch(/Display_Clear\s*\(\s*void\s*\)/); expect(w06Display).toMatch(/Display_WriteLine\s*\(/); expect(w06Display).toMatch(/Display_Refresh\s*\(\s*void\s*\)/);
    expect(w06Display.match(/void\s+Display_/g)).toHaveLength(4);
    expect(w06DisplaySource).toMatch(/framebuffer\s*\[\s*1024U?\s*\]/);
    expect(w06DisplaySource).toMatch(/SSD1306_ADDRESS\s*=\s*0x3CU/);
    expect(w06DisplaySource).toMatch(/HAL_GPIO_WritePin\s*\(\s*OLED_SCL_GPIO_Port\s*,\s*OLED_SCL_Pin/);
    expect(w06DisplaySource).toMatch(/HAL_GPIO_WritePin\s*\(\s*OLED_SDA_GPIO_Port\s*,\s*OLED_SDA_Pin/);
    expect(w06DisplaySource).toMatch(/HAL_GPIO_ReadPin\s*\(\s*OLED_SDA_GPIO_Port\s*,\s*OLED_SDA_Pin\s*\)/);
    expect(w06DisplaySource).toMatch(/i2c_start\s*\(/); expect(w06DisplaySource).toMatch(/i2c_stop\s*\(/); expect(w06DisplaySource).toMatch(/i2c_write_byte\s*\(/);
    expect(w06DisplaySource).toMatch(/SSD1306_ADDRESS\s*<<\s*1U/);
    expect(w06DisplaySource).toMatch(/SSD1306_CONTROL_COMMAND\s*=\s*0x00U/); expect(w06DisplaySource).toMatch(/SSD1306_CONTROL_DATA\s*=\s*0x40U/);
    expect(w06DisplaySource).toMatch(/0xAEU/); expect(w06DisplaySource).toMatch(/0x8DU/); expect(w06DisplaySource).toMatch(/0x14U/); expect(w06DisplaySource).toMatch(/0xAFU/);
    expect(w06DisplaySource).toMatch(/0x20U\s*,\s*0x02U/);
    expect(w06DisplaySource).toMatch(/for\s*\([^)]*page[^)]*<\s*8U/); expect(w06DisplaySource).toMatch(/for\s*\([^)]*column[^)]*<\s*128U/);
    expect(w06App).toMatch(/Display_Init/); expect(w06App).toMatch(/Display_WriteLine/);
    expect(w06App).toMatch(/HAL_GPIO_ReadPin\s*\(\s*DEBUG_INPUT_GPIO_Port\s*,\s*DEBUG_INPUT_Pin\s*\)/); expect(w06App).not.toMatch(/Input:unknown/);
    expect(w07Ioc).toMatch(/PA0-WKUP\.GPIO_Label=IR_PULSE/); expect(w07Ioc).toMatch(/PA0-WKUP\.GPIO_PuPd=GPIO_PULLDOWN/); expect(w07Ioc).toMatch(/PA0-WKUP\.GPIO_Mode=GPIO_MODE_IT_RISING/); expect(w07Ioc).toMatch(/PA0-WKUP\.GPIO_ModeDefaultEXTI=GPIO_MODE_IT_RISING/);
    expect(w07Ioc).toMatch(/PA1\.GPIO_Mode=GPIO_MODE_IT_RISING/); expect(w07Ioc).toMatch(/PA1\.GPIO_ModeDefaultEXTI=GPIO_MODE_IT_RISING/);
    expect(w07Gpio).toMatch(/IR_PULSE_Pin[\s\S]*GPIO_MODE_IT_RISING[\s\S]*GPIO_PULLDOWN/); expect(w07Gpio).toMatch(/ENCODER_B_Pin[\s\S]*GPIO_MODE_INPUT[\s\S]*GPIO_PULLUP/);
    expect(w07Gpio).toMatch(/HAL_NVIC_SetPriority\s*\(\s*EXTI0_IRQn\s*,\s*2\s*,\s*0\s*\)/); expect(w07Gpio).toMatch(/HAL_NVIC_SetPriority\s*\(\s*EXTI1_IRQn\s*,\s*3\s*,\s*0\s*\)/);
    expect(w07It).toMatch(/HAL_GPIO_EXTI_IRQHandler\s*\(\s*IR_PULSE_Pin\s*\)/); expect(w07It).toMatch(/App_On/); expect(w07App).toMatch(/App_On.*Event/);
    expect(w07App).toMatch(/volatile\s+int32_t\s+encoder_events/); expect(w07App).toMatch(/int32_t\s+App_EncoderCount/);
    expect(w08Main.match(/#include\s+"tim\.h"/g)).toHaveLength(1); expect(w08Main.match(/\bMX_TIM2_Init\s*\(\s*\)\s*;/g)).toHaveLength(1); expect(w08Main.match(/\bMX_TIM3_Init\s*\(\s*\)\s*;/g)).toHaveLength(1);
    expect(w08Tim).toMatch(/htim2\.Init\.Prescaler\s*=\s*71/); expect(w08Tim).toMatch(/htim2\.Init\.Period\s*=\s*999/); expect(w08Ioc).toMatch(/TIM2\.Prescaler=71/); expect(w08Ioc).toMatch(/TIM2\.Period=999/);
    expect(w08Tim).toMatch(/HAL_TIM_SlaveConfigSynchro/); expect(w08Tim).toMatch(/TIM_SLAVEMODE_EXTERNAL1/); expect(w08Tim).toMatch(/TIM_TS_TI1FP1/); expect(w08Ioc).toMatch(/PA6\.Signal=S_TIM3_CH1/); expect(w08Ioc).toMatch(/TIM3\.TIM_SlaveMode=TIM_SLAVEMODE_EXTERNAL1/);
    expect(w08Main).toMatch(/HAL_TIM_Base_Start_IT\s*\(\s*&htim2\s*\)/); expect(w08Main).toMatch(/HAL_TIM_Base_Start\s*\(\s*&htim3\s*\)/); expect(w08Main).toMatch(/HAL_TIM_PeriodElapsedCallback[\s\S]*App_OnTimerElapsed/); expect(w08It).toMatch(/TIM2_IRQHandler[\s\S]*HAL_TIM_IRQHandler\s*\(\s*&htim2\s*\)/);
    expect(w08App).toMatch(/volatile\s+uint32_t\s+elapsed_seconds/); expect(w08App).toMatch(/last_reported_seconds/); expect(w08App).toMatch(/__HAL_TIM_GET_COUNTER\s*\(\s*&htim3\s*\)/);
  });

  it('rejects key pin, IRQ, display and timer mutations', async () => {
    const display = await text('firmware/lessons/w06-oled-debug/App/Display/display.h');
    const displaySource = await text('firmware/lessons/w06-oled-debug/App/Display/display.c');
    const w05App = await text('firmware/lessons/w05-gpio-input/App/app.c');
    const w05Ioc = await text('firmware/lessons/w05-gpio-input/w05-gpio-input.ioc');
    const irq = await text('firmware/lessons/w07-exti-events/Core/Src/stm32f1xx_it.c');
    const w07Ioc = await text('firmware/lessons/w07-exti-events/w07-exti-events.ioc');
    const timer = await text('firmware/lessons/w08-tim-timebase/Core/Src/tim.c');
    const timerMain = await text('firmware/lessons/w08-tim-timebase/Core/Src/main.c');
    expect(display.replace('Display_Refresh', 'Refresh')).not.toMatch(/Display_Refresh\s*\(/);
    expect(displaySource.replace('HAL_GPIO_ReadPin', 'RemovedAckRead')).not.toMatch(/HAL_GPIO_ReadPin\s*\(/);
    expect(displaySource.replace('SSD1306_CONTROL_DATA = 0x40U', 'SSD1306_CONTROL_DATA = 0x00U')).not.toMatch(/SSD1306_CONTROL_DATA\s*=\s*0x40U/);
    expect(displaySource.replace(/for\s*\([^)]*column[^)]*<\s*128U/, 'for (uint8_t column = 0U; column < 1U')).not.toMatch(/for\s*\([^)]*column[^)]*<\s*128U/);
    expect(irq).toMatch(/if\s*\(\s*GPIO_Pin\s*==\s*IR_PULSE_Pin\s*\)\s*App_OnIrEvent\s*\(\s*\);/);
    expect(irq).toMatch(/if\s*\(\s*GPIO_Pin\s*==\s*ENCODER_Pin\s*\)\s*App_OnEncoderEvent\s*\(/);
    expect(irq.replace('App_OnIrEvent();', '')).not.toMatch(/App_OnIrEvent/);
    expect(irq.replace(/App_OnEncoderEvent\s*\([^;]+;\s*/, '')).not.toMatch(/App_OnEncoderEvent/);
    expect(timer.replace('htim2.Init.Period = 999', 'htim2.Init.Period = 998')).not.toMatch(/htim2\.Init\.Period\s*=\s*999/);
    expect(timer.replace('TIM_SLAVEMODE_EXTERNAL1', 'TIM_SLAVEMODE_DISABLE')).not.toMatch(/TIM_SLAVEMODE_EXTERNAL1/);
    expect(timerMain.replace(/HAL_TIM_Base_Start_IT\s*\(\s*&htim2\s*\)/, 'RemovedTimerStart()')).not.toMatch(/HAL_TIM_Base_Start_IT\s*\(\s*&htim2\s*\)/);
    expect(w07Ioc.replace('PA0-WKUP.GPIO_ModeDefaultEXTI=GPIO_MODE_IT_RISING', 'PA0-WKUP.GPIO_ModeDefaultEXTI=GPIO_MODE_IT_FALLING')).not.toMatch(/PA0-WKUP\.GPIO_ModeDefaultEXTI=GPIO_MODE_IT_RISING/);
    expect(w05App.replace('DEBOUNCE_MS = 20U', 'DEBOUNCE_MS = 1U')).not.toMatch(/DEBOUNCE_MS\s*=\s*20U/);
    expect(w05Ioc.replace('PA1.GPIO_Mode=GPIO_MODE_INPUT', 'PA1.GPIO_Mode=GPIO_MODE_ANALOG')).not.toMatch(/PA1\.GPIO_Mode=GPIO_MODE_INPUT/);
  });
});
