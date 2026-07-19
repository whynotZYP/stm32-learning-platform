import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

const WEEKS = [
  { week: 9, suffix: 'w09', id: 'w09-pwm-basics', lab: 'lab-w09-pwm', assessment: 'assessment-w09', sources: ['15'], project: 'w09-pwm' },
  { week: 10, suffix: 'w10', id: 'w10-pwm-actuators', lab: 'lab-w10-actuators', assessment: 'assessment-w10', sources: ['16'], project: 'w10-actuators' },
  { week: 11, suffix: 'w11', id: 'w11-tim-measurement', lab: 'lab-w11-tim-measurement', assessment: 'assessment-w11', sources: ['17', '18', '19', '20'], project: 'w11-tim-measurement' },
  { week: 12, suffix: 'w12', id: 'w12-adc', lab: 'lab-w12-adc', assessment: 'assessment-w12', sources: ['21', '22'], project: 'w12-adc' },
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

describe('phase 3 curriculum contract', () => {
  it('uses the course-map lesson IDs and source groups while keeping firmware names distinct', async () => {
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
    const gate = await json('assessments/practicals/gate-03.json');
    expect(gate).toMatchObject({ id: 'gate-03', phase: 3, lessonIds: WEEKS.map((item) => item.id) });
    expect(totals(gate.items)).toEqual({ concept: 25, configuration: 25, practical: 35, reflection: 15 });
  });

  it('teaches PWM, actuator safety, capture and ADC with honest evidence boundaries', async () => {
    const pages = await Promise.all(WEEKS.map((item) => text(`curriculum/weeks/${item.suffix}.md`)));
    const labs = await Promise.all(WEEKS.map((item) => json(`labs/manifests/${item.lab}.json`)));
    expect(pages[0]).toMatch(/输出比较|output compare/i); expect(pages[0]).toMatch(/1\s*kHz/i); expect(pages[0]).toMatch(/预装载|preload/i); expect(pages[0]).toMatch(/极性|polarity/i); expect(pages[0]).toMatch(/复用|alternate function/i); expect(pages[0]).toMatch(/呼吸/);
    expect(pages[1]).toMatch(/500\s*[-–—~至到]+\s*2500\s*(?:µs|us)/i); expect(pages[1]).toMatch(/TB6612/); expect(pages[1]).toMatch(/感性负载/); expect(pages[1]).toMatch(/STBY/); expect(pages[1]).toMatch(/独立供电/); expect(pages[1]).toMatch(/共地/);
    expect(pages[2]).toMatch(/输入捕获|input capture/i); expect(pages[2]).toMatch(/边沿时间戳/); expect(pages[2]).toMatch(/溢出/); expect(pages[2]).toMatch(/从模式.*复位|slave reset/is); expect(pages[2]).toMatch(/编码器.*速度|速度.*编码器/s); expect(pages[2]).toMatch(/2\s*%/);
    expect(pages[3]).toMatch(/逐次逼近/); expect(pages[3]).toMatch(/参考电压|VREF/i); expect(pages[3]).toMatch(/采样时间/); expect(pages[3]).toMatch(/通道顺序/); expect(pages[3]).toMatch(/对齐/); expect(pages[3]).toMatch(/校准/); expect(pages[3]).toMatch(/模拟.*GPIO|GPIO.*模拟/s); expect(pages[3]).toMatch(/raw/i); expect(pages[3]).toMatch(/mV/);
    for (const page of pages) { expect(page).toMatch(/3\.3\s*V/); expect(page).toMatch(/断电/); expect(page).toMatch(/共地/); expect(page).toMatch(/https:\/\/.*st\.com/i); }
    expect(JSON.stringify(labs[1])).toMatch(/独立供电/); expect(JSON.stringify(labs[1])).toMatch(/共地/);
    const actuatorAutomatic = labs[1].detectionChecks.find((item: any) => item.mode === 'automatic');
    expect(actuatorAutomatic).toMatchObject({ applicable: true, physicalHardware: false });
    expect(`${actuatorAutomatic.expectedEvidence} ${actuatorAutomatic.limitation}`).toMatch(/不.*运动|不能.*运动|不代表.*运动/);
    expect(labs[1].detectionChecks.find((item: any) => item.mode === 'semi-automatic').applicable).toBe(false);
    const gate = JSON.stringify(await json('assessments/practicals/gate-03.json'));
    expect(gate).toMatch(/PSC|ARR/); expect(gate).toMatch(/2\s*%/); expect(gate).toMatch(/独立供电/); expect(gate).toMatch(/共地/); expect(gate).toMatch(/ADC/); expect(gate).toMatch(/采样时间|模拟/);
  });
});

describe('phase 3 firmware boundaries', () => {
  it('generates 1 kHz PWM and changes duty in bounded steps', async () => {
    const ioc = await text('firmware/lessons/w09-pwm/w09-pwm.ioc');
    const tim = await text('firmware/lessons/w09-pwm/Core/Src/tim.c');
    const app = await text('firmware/lessons/w09-pwm/App/app.c');
    expect(ioc).toMatch(/PA0-WKUP\.Signal=S_TIM2_CH1_ETR/); expect(ioc).toMatch(/TIM2\.Prescaler=71/); expect(ioc).toMatch(/TIM2\.Period=999/); expect(ioc).toMatch(/TIM2\.Channel-PWM\\ Generation1\\ CH1=TIM_CHANNEL_1/);
    expect(tim).toMatch(/htim2\.Init\.Prescaler\s*=\s*71/); expect(tim).toMatch(/htim2\.Init\.Period\s*=\s*999/); expect(tim).toMatch(/TIM_OCMODE_PWM1/); expect(tim).toMatch(/HAL_TIM_PWM_ConfigChannel/);
    expect(app).toMatch(/__HAL_TIM_ENABLE_OCxPRELOAD\s*\(\s*&htim2\s*,\s*TIM_CHANNEL_1\s*\)/); expect(app).toMatch(/HAL_TIM_PWM_Start\s*\(\s*&htim2\s*,\s*TIM_CHANNEL_1\s*\)/); expect(app).toMatch(/__HAL_TIM_SET_COMPARE/); expect(app).toMatch(/DUTY_STEP\s*=\s*100U/); expect(app).toMatch(/HAL_GetTick/); expect(app).not.toMatch(/HAL_Delay/);
  });

  it('rejects unsafe actuator commands before changing timer or bridge outputs', async () => {
    const ioc = await text('firmware/lessons/w10-actuators/w10-actuators.ioc');
    const tim = await text('firmware/lessons/w10-actuators/Core/Src/tim.c');
    const actuators = await text('firmware/lessons/w10-actuators/App/actuators.c');
    const app = await text('firmware/lessons/w10-actuators/App/app.c');
    expect(ioc).toMatch(/PA0-WKUP\.Signal=S_TIM2_CH1_ETR/); expect(ioc).toMatch(/PA6\.Signal=S_TIM3_CH1/); expect(ioc).toMatch(/TIM2\.Period=19999/); expect(ioc).toMatch(/TIM3\.Period=49/);
    expect(ioc).toMatch(/PA1\.GPIO_Label=MOTOR_IN1[\s\S]*PA1\.PinState=GPIO_PIN_RESET/); expect(ioc).toMatch(/PA2\.GPIO_Label=MOTOR_IN2[\s\S]*PA2\.PinState=GPIO_PIN_RESET/); expect(ioc).toMatch(/PB0\.GPIO_Label=MOTOR_STBY[\s\S]*PB0\.PinState=GPIO_PIN_RESET/);
    expect(tim).toMatch(/htim2\.Init\.Period\s*=\s*19999/); expect(tim).toMatch(/htim3\.Init\.Period\s*=\s*49/);
    expect(actuators).toMatch(/Actuators_SetServoPulseUs/); expect(actuators).toMatch(/pulse_us\s*<\s*500U\s*\|\|\s*pulse_us\s*>\s*2500U/);
    expect(actuators).toMatch(/Actuators_SetMotorCommand/); expect(actuators).toMatch(/command\s*<\s*-1000\s*\|\|\s*command\s*>\s*1000/);
    expect(actuators.indexOf('pulse_us < 500U')).toBeLessThan(actuators.indexOf('__HAL_TIM_SET_COMPARE(&htim2'));
    expect(actuators.indexOf('command < -1000')).toBeLessThan(actuators.indexOf('__HAL_TIM_SET_COMPARE(&htim3'));
    expect(actuators).toMatch(/command\s*<\s*-1000[\s\S]*?return HAL_ERROR;\s*HAL_GPIO_WritePin\s*\(\s*MOTOR_STBY_GPIO_Port\s*,\s*MOTOR_STBY_Pin\s*,\s*GPIO_PIN_RESET\s*\);\s*if\s*\(\s*command\s*==\s*0\s*\)/);
    expect(actuators).toMatch(/MOTOR_IN1_Pin/); expect(actuators).toMatch(/MOTOR_IN2_Pin/); expect(actuators).toMatch(/MOTOR_STBY_Pin/);
    expect(app).toMatch(/Actuators_Init/); expect(app).toMatch(/Actuators_SetServoPulseUs/); expect(app).toMatch(/Actuators_SetMotorCommand/);
  });

  it('measures PWM frequency and duty with overflow handling and reports encoder speed', async () => {
    const ioc = await text('firmware/lessons/w11-tim-measurement/w11-tim-measurement.ioc');
    const tim = await text('firmware/lessons/w11-tim-measurement/Core/Src/tim.c');
    const main = await text('firmware/lessons/w11-tim-measurement/Core/Src/main.c');
    const app = await text('firmware/lessons/w11-tim-measurement/App/app.c');
    expect(ioc).toMatch(/PA0-WKUP\.Signal=S_TIM2_CH1_ETR/); expect(ioc).toMatch(/PA6\.Signal=S_TIM3_CH1/); expect(ioc).toMatch(/SH\.S_TIM3_CH1\.0=TIM3_CH1,PWM_Input_1/); expect(ioc).toMatch(/PB6\.Signal=S_TIM4_CH1/); expect(ioc).toMatch(/PB7\.Signal=S_TIM4_CH2/);
    expect(ioc).not.toMatch(/^PA7\./m); expect(app).toMatch(/__HAL_TIM_URS_ENABLE\s*\(\s*&htim3\s*\)/);
    expect(tim).toMatch(/TIM_OCMODE_PWM1/); expect(tim).toMatch(/TIM_SLAVEMODE_RESET/); expect(tim).toMatch(/TIM_TS_TI1FP1/); expect(tim).toMatch(/TIM_ENCODERMODE_TI12/);
    expect(tim).toMatch(/TIM_INPUTCHANNELPOLARITY_RISING[\s\S]*TIM_ICSELECTION_DIRECTTI/); expect(tim).toMatch(/TIM_INPUTCHANNELPOLARITY_FALLING[\s\S]*TIM_ICSELECTION_INDIRECTTI/); expect(tim.match(/HAL_TIM_IC_ConfigChannel/g)).toHaveLength(2);
    const startup = `${main}\n${app}`;
    expect(startup).toMatch(/HAL_TIM_PWM_Start\s*\(\s*&htim2\s*,\s*TIM_CHANNEL_1/); expect(startup).toMatch(/HAL_TIM_IC_Start_IT\s*\(\s*&htim3\s*,\s*TIM_CHANNEL_1/); expect(startup).toMatch(/HAL_TIM_IC_Start_IT\s*\(\s*&htim3\s*,\s*TIM_CHANNEL_2/); expect(startup).toMatch(/HAL_TIM_Encoder_Start\s*\(\s*&htim4\s*,\s*TIM_CHANNEL_ALL/);
    expect(app).toMatch(/HAL_TIM_IC_CaptureCallback/); expect(app).toMatch(/HAL_TIM_PeriodElapsedCallback/); expect(app).toMatch(/capture_overflows/); expect(app).toMatch(/period_ticks\s*=.*capture_overflows/s); expect(app).toMatch(/frequency_hz\s*=\s*CAPTURE_CLOCK_HZ\s*\/\s*period_ticks/); expect(app).toMatch(/duty_per_mille\s*=.*high_ticks.*1000U.*period_ticks/s); expect(app).toMatch(/encoder_speed\s*=.*encoder_delta/s);
  });

  it('calibrates ADC once and exposes three raw and millivolt readings', async () => {
    const ioc = await text('firmware/lessons/w12-adc/w12-adc.ioc');
    const adc = await text('firmware/lessons/w12-adc/Core/Src/adc.c');
    const app = await text('firmware/lessons/w12-adc/App/app.c');
    const appHeader = await text('firmware/lessons/w12-adc/App/app.h');
    expect(ioc).toMatch(/PA0-WKUP\.Signal=ADCx_IN0/); expect(ioc).toMatch(/PA1\.Signal=ADCx_IN1/); expect(ioc).toMatch(/PA2\.Signal=ADCx_IN2/); expect(ioc).toMatch(/SH\.ADCx_IN0\.0=ADC1_IN0,IN0/); expect(ioc).toMatch(/SH\.ADCx_IN1\.0=ADC1_IN1,IN1/); expect(ioc).toMatch(/SH\.ADCx_IN2\.0=ADC1_IN2,IN2/);
    expect(ioc).toMatch(/ADC1\.SamplingTime-0\\#ChannelRegularConversion=ADC_SAMPLETIME_239CYCLES_5/); expect(ioc).toMatch(/ADC1\.SamplingTime-1\\#ChannelRegularConversion=ADC_SAMPLETIME_239CYCLES_5/); expect(ioc).toMatch(/ADC1\.SamplingTime-2\\#ChannelRegularConversion=ADC_SAMPLETIME_239CYCLES_5/);
    expect(ioc).toMatch(/ADC1\.Rank-0\\#ChannelRegularConversion=1/); expect(ioc).toMatch(/ADC1\.Rank-1\\#ChannelRegularConversion=2/); expect(ioc).toMatch(/ADC1\.Rank-2\\#ChannelRegularConversion=3/);
    expect(ioc).toMatch(/ADC1\.DiscontinuousConvMode=ENABLE/); expect(ioc).toMatch(/ADC1\.NbrOfDiscConversion=1/);
    expect(adc).toMatch(/ADC_SCAN_ENABLE/); expect(adc).toMatch(/NbrOfConversion\s*=\s*3/); expect(adc).toMatch(/DiscontinuousConvMode\s*=\s*ENABLE/); expect(adc).toMatch(/NbrOfDiscConversion\s*=\s*1/); expect(adc.match(/HAL_ADC_ConfigChannel/g)).toHaveLength(3);
    expect(adc).toMatch(/GPIO_MODE_ANALOG/); expect(adc).toMatch(/GPIO_PIN_0\|GPIO_PIN_1\|GPIO_PIN_2/);
    expect(app.match(/HAL_ADCEx_Calibration_Start/g)).toHaveLength(1); expect(app).toMatch(/for\s*\([^)]*index[^)]*<\s*ADC_CHANNEL_COUNT[^)]*\)\s*\{[\s\S]*HAL_ADC_Start[\s\S]*HAL_ADC_PollForConversion[\s\S]*HAL_ADC_GetValue[\s\S]*\}/); expect(app).toMatch(/HAL_ADC_PollForConversion\s*\(\s*&hadc1\s*,\s*10U\s*\)/); expect(app).toMatch(/HAL_ADC_Stop\s*\(\s*&hadc1\s*\)/); expect(app.indexOf('HAL_ADC_PollForConversion')).toBeLessThan(app.indexOf('HAL_ADC_Stop')); expect(app).toMatch(/3300U/); expect(app).toMatch(/4095U/);
    expect(appHeader).toMatch(/uint16_t\s+raw\s*\[\s*3U?\s*\]/); expect(appHeader).toMatch(/uint16_t\s+millivolts\s*\[\s*3U?\s*\]/); expect(appHeader).toMatch(/App_GetAdcReadings/);
  });

  it('rejects key preload, actuator, capture and ADC mutations', async () => {
    const w09App = await text('firmware/lessons/w09-pwm/App/app.c');
    const actuators = await text('firmware/lessons/w10-actuators/App/actuators.c');
    const w11Tim = await text('firmware/lessons/w11-tim-measurement/Core/Src/tim.c');
    const w11App = await text('firmware/lessons/w11-tim-measurement/App/app.c');
    const w12Ioc = await text('firmware/lessons/w12-adc/w12-adc.ioc');
    const w12Adc = await text('firmware/lessons/w12-adc/Core/Src/adc.c');
    const w12App = await text('firmware/lessons/w12-adc/App/app.c');
    expect(w09App.replace('__HAL_TIM_ENABLE_OCxPRELOAD', 'RemovedPreload')).not.toMatch(/__HAL_TIM_ENABLE_OCxPRELOAD/);
    expect(actuators.replace('pulse_us < 500U', 'pulse_us < 0U')).not.toMatch(/pulse_us\s*<\s*500U/);
    expect(actuators.replace('command < -1000', 'command < -32768')).not.toMatch(/command\s*<\s*-1000/);
    expect(w11Tim.replace('TIM_SLAVEMODE_RESET', 'TIM_SLAVEMODE_DISABLE')).not.toMatch(/TIM_SLAVEMODE_RESET/);
    expect(w11App.replace('__HAL_TIM_URS_ENABLE(&htim3)', 'RemovedUrs()')).not.toMatch(/__HAL_TIM_URS_ENABLE/);
    expect(w12App.replace('HAL_ADCEx_Calibration_Start', 'RemovedCalibration')).not.toMatch(/HAL_ADCEx_Calibration_Start/);
    expect(w12Adc.replace('GPIO_MODE_ANALOG', 'GPIO_MODE_INPUT')).not.toMatch(/GPIO_MODE_ANALOG/);
    expect(w12Ioc.replace('ADC1.Rank-2\\#ChannelRegularConversion=3', 'ADC1.Rank-2\\#ChannelRegularConversion=2')).not.toMatch(/ADC1\.Rank-2\\#ChannelRegularConversion=3/);
  });
});
