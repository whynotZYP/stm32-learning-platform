import type { DetectionCheck } from '../../domain/content/types';

export interface DeviceTestDefinition {
  id: string;
  title: string;
  detectionCheck: DetectionCheck;
  timeoutMs: number;
  firmwareVersion: 'device-test-v1';
  wiring: string[];
  safety: string[];
  lessonTagIds: string[];
}

function detectionCheck(
  mode: 'automatic' | 'semi-automatic',
  action: string,
  expectedEvidence: string,
  limitation: string,
): DetectionCheck {
  return {
    mode,
    action,
    expectedEvidence,
    limitation,
    applicable: true,
    evidenceSource: 'device',
    physicalHardware: true,
  };
}

const COMMON_SERIAL_WIRING = [
  'PA9 TX 接 CH340 RX，PA10 RX 接 CH340 TX，并连接 GND',
];
const COMMON_SERIAL_SAFETY = [
  '确认 CH340 为 3.3 V TTL，且开发板与转接板只选择一个供电来源',
];

export const DEVICE_TESTS: readonly DeviceTestDefinition[] = [
  {
    id: 'system.hello',
    title: '检测固件握手',
    detectionCheck: detectionCheck('automatic', '读取协议、固件和构建版本', '返回 protocol=1 与 device-test-v1', '只能证明检测固件能够通信'),
    timeoutMs: 2_000,
    firmwareVersion: 'device-test-v1',
    wiring: COMMON_SERIAL_WIRING,
    safety: COMMON_SERIAL_SAFETY,
    lessonTagIds: ['toolchain.build-debug', 'debug.observation'],
  },
  {
    id: 'system.chip-id',
    title: '读取芯片唯一标识',
    detectionCheck: detectionCheck('automatic', '读取 STM32 三个唯一标识字', '返回三个非空 UID 数值', '只能证明当前连接芯片的标识可读'),
    timeoutMs: 2_000,
    firmwareVersion: 'device-test-v1',
    wiring: COMMON_SERIAL_WIRING,
    safety: COMMON_SERIAL_SAFETY,
    lessonTagIds: ['mcu.memory-map', 'flash.persistence'],
  },
  {
    id: 'gpio.loopback',
    title: 'GPIO 高低电平回环',
    detectionCheck: detectionCheck('automatic', '依次输出低电平和高电平并读取回环输入', '低电平与高电平均正确返回', '需要专用短接线，不能证明 LED 亮度'),
    timeoutMs: 3_000,
    firmwareVersion: 'device-test-v1',
    wiring: ['按检测固件标注短接 GPIO_TEST_OUT 与 GPIO_TEST_IN', ...COMMON_SERIAL_WIRING],
    safety: ['断电完成回环接线，确认两引脚均未连接外部电源', ...COMMON_SERIAL_SAFETY],
    lessonTagIds: ['gpio.output-mode', 'gpio.input-bias'],
  },
  {
    id: 'exti.event-count',
    title: 'EXTI 事件计数',
    detectionCheck: detectionCheck('semi-automatic', '在十秒窗口内触发外部输入并记录计数', '返回事件次数和时间戳，学习者确认实际动作', '自动数据不能证明手部动作或传感器现象'),
    timeoutMs: 15_000,
    firmwareVersion: 'device-test-v1',
    wiring: ['按检测固件标注连接 EXTI 输入，或使用板载按键', ...COMMON_SERIAL_WIRING],
    safety: ['外部信号必须限制在 0–3.3 V，接线前断电复核', ...COMMON_SERIAL_SAFETY],
    lessonTagIds: ['exti.event-flow'],
  },
  {
    id: 'tim.pwm-capture',
    title: 'PWM 与输入捕获回环',
    detectionCheck: detectionCheck('automatic', '输出固定 PWM 并用输入捕获测量', '频率与占空比误差均在 2% 内', '只能证明电信号参数，不能证明执行器动作'),
    timeoutMs: 5_000,
    firmwareVersion: 'device-test-v1',
    wiring: ['按检测固件标注短接 PWM_TEST_OUT 与 CAPTURE_TEST_IN', ...COMMON_SERIAL_WIRING],
    safety: ['断电完成定时器回环接线，不并接电机或舵机', ...COMMON_SERIAL_SAFETY],
    lessonTagIds: ['tim.pwm', 'tim.capture'],
  },
  {
    id: 'adc.range-dma',
    title: 'ADC 范围与 DMA 采样',
    detectionCheck: detectionCheck('semi-automatic', '在安全范围内改变模拟输入并采集三十二点', '返回最小值、最大值、变化量和 DMA 计数', '学习者必须确认实际旋钮或传感器发生变化'),
    timeoutMs: 8_000,
    firmwareVersion: 'device-test-v1',
    wiring: ['把 0–3.3 V 模拟源接到 ADC_TEST_IN，并连接 GND', ...COMMON_SERIAL_WIRING],
    safety: ['ADC 输入禁止超过 3.3 V，接线前断电复核', ...COMMON_SERIAL_SAFETY],
    lessonTagIds: ['adc.sampling', 'dma.transfer'],
  },
  {
    id: 'dma.memory-copy',
    title: 'DMA 内存搬运',
    detectionCheck: detectionCheck('automatic', '用 DMA 搬运固定数组并比较内容和标志', '源数组与目标数组完全一致', '只证明这次固定数据搬运'),
    timeoutMs: 3_000,
    firmwareVersion: 'device-test-v1',
    wiring: COMMON_SERIAL_WIRING,
    safety: COMMON_SERIAL_SAFETY,
    lessonTagIds: ['dma.transfer'],
  },
  {
    id: 'usart.packet',
    title: 'USART 数据包回环',
    detectionCheck: detectionCheck('automatic', '发送固定帧并检查回显、校验和错误计数', '正确帧回显且边界计数符合预期', '只能证明协议测试帧和缓冲区边界'),
    timeoutMs: 5_000,
    firmwareVersion: 'device-test-v1',
    wiring: COMMON_SERIAL_WIRING,
    safety: COMMON_SERIAL_SAFETY,
    lessonTagIds: ['usart.physical-frame', 'usart.packet'],
  },
  {
    id: 'i2c.mpu6050-id',
    title: 'MPU6050 身份读取',
    detectionCheck: detectionCheck('automatic', '通过 I2C 读取 MPU6050 WHO_AM_I', '返回 0x68 或已配置的地址变体', '只能证明器件应答和身份寄存器'),
    timeoutMs: 5_000,
    firmwareVersion: 'device-test-v1',
    wiring: ['PB6 接 SCL、PB7 接 SDA，模块使用 3.3 V 与共地', ...COMMON_SERIAL_WIRING],
    safety: ['确认 I2C 上拉接 3.3 V，禁止接 5 V 上拉', ...COMMON_SERIAL_SAFETY],
    lessonTagIds: ['i2c.protocol', 'i2c.mpu6050'],
  },
  {
    id: 'spi.flash-id',
    title: 'W25Q64 身份读取',
    detectionCheck: detectionCheck('automatic', '通过 SPI 读取 W25Q64 JEDEC ID', '返回非全零和非全 FF 的器件标识', '只读操作不能证明擦写可靠性'),
    timeoutMs: 5_000,
    firmwareVersion: 'device-test-v1',
    wiring: ['按检测固件标注连接 W25Q64 CS、SCK、MISO、MOSI、3.3 V 与 GND', ...COMMON_SERIAL_WIRING],
    safety: ['W25Q64 只能使用 3.3 V，先断电再检查 SPI 接线', ...COMMON_SERIAL_SAFETY],
    lessonTagIds: ['spi.protocol', 'spi.w25q64'],
  },
  {
    id: 'spi.flash-roundtrip',
    title: 'W25Q64 固定扇区往返',
    detectionCheck: detectionCheck('automatic', '备份固定测试扇区后擦写、校验、恢复并复核', '测试数据一致且原数据恢复复核成功', '仅允许固件声明的保留测试扇区'),
    timeoutMs: 20_000,
    firmwareVersion: 'device-test-v1',
    wiring: ['使用 W25Q64 固定保留测试扇区，执行前完整备份', '按检测固件标注连接 SPI 与 3.3 V', ...COMMON_SERIAL_WIRING],
    safety: ['测试后必须恢复原扇区并复核；恢复失败立即标记失败', ...COMMON_SERIAL_SAFETY],
    lessonTagIds: ['spi.w25q64'],
  },
  {
    id: 'rtc.bkp',
    title: 'RTC 与备份寄存器',
    detectionCheck: detectionCheck('semi-automatic', '读写备份寄存器并观察 RTC 计数推进', '备份值一致且 RTC 计数增加', '真正断电后的保持效果仍需学习者确认'),
    timeoutMs: 10_000,
    firmwareVersion: 'device-test-v1',
    wiring: ['按课程接入 32.768 kHz 晶振或使用明确标注的 RTC 时钟源', ...COMMON_SERIAL_WIRING],
    safety: ['不要在带电状态改动晶振或 VBAT 接线', ...COMMON_SERIAL_SAFETY],
    lessonTagIds: ['rtc.time'],
  },
  {
    id: 'wdg.reset-cause',
    title: '看门狗复位原因',
    detectionCheck: detectionCheck('semi-automatic', '执行两阶段看门狗复位并在重连后读取原因', '返回看门狗复位标志并清除一次性标记', '需要学习者确认断线、重连和重新握手过程'),
    timeoutMs: 20_000,
    firmwareVersion: 'device-test-v1',
    wiring: COMMON_SERIAL_WIRING,
    safety: ['确认当前没有进行 FLASH 擦写，再启动故意复位', ...COMMON_SERIAL_SAFETY],
    lessonTagIds: ['wdg.recovery'],
  },
  {
    id: 'flash.reserved-page',
    title: '片内 FLASH 保留页往返',
    detectionCheck: detectionCheck('automatic', '备份链接脚本保留页后擦写、校验、恢复并复核', '测试数据一致且保留页原数据恢复成功', '地址必须由链接符号证明位于程序和数据之外'),
    timeoutMs: 20_000,
    firmwareVersion: 'device-test-v1',
    wiring: COMMON_SERIAL_WIRING,
    safety: ['只允许固定保留页；先备份，完成后恢复并复核，失败立即停止', ...COMMON_SERIAL_SAFETY],
    lessonTagIds: ['flash.persistence'],
  },
  {
    id: 'pwr.sleep-wake',
    title: '低功耗与唤醒',
    detectionCheck: detectionCheck('semi-automatic', '进入选定安全模式并在唤醒后报告原因', '重连后返回唤醒或复位来源', '真实电流和真实断电行为必须人工测量'),
    timeoutMs: 30_000,
    firmwareVersion: 'device-test-v1',
    wiring: ['按检测固件标注连接安全唤醒源', ...COMMON_SERIAL_WIRING],
    safety: ['进入低功耗前停止电机等外部负载，保留可用唤醒路径', ...COMMON_SERIAL_SAFETY],
    lessonTagIds: ['pwr.low-power'],
  },
];

export function getDeviceTest(id: string): DeviceTestDefinition {
  const definition = DEVICE_TESTS.find((test) => test.id === id);
  if (!definition) throw new Error(`未知开发板检测：${id}`);
  return definition;
}
