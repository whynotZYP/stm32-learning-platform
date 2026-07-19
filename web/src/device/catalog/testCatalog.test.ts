import { describe, expect, it } from 'vitest';

import { DetectionCheckSchema } from '../../domain/content/schemas';
import { DEVICE_TESTS, getDeviceTest } from './testCatalog';

const TEST_IDS = [
  'system.hello',
  'system.chip-id',
  'gpio.loopback',
  'exti.event-count',
  'tim.pwm-capture',
  'adc.range-dma',
  'dma.memory-copy',
  'usart.packet',
  'i2c.mpu6050-id',
  'spi.flash-id',
  'spi.flash-roundtrip',
  'rtc.bkp',
  'wdg.reset-cause',
  'flash.reserved-page',
  'pwr.sleep-wake',
] as const;

describe('device test catalog', () => {
  it('contains the 15 protocol IDs exactly once', () => {
    expect(DEVICE_TESTS.map((test) => test.id)).toEqual(TEST_IDS);
    expect(new Set(DEVICE_TESTS.map((test) => test.id)).size).toBe(TEST_IDS.length);
    expect(getDeviceTest('system.hello').id).toBe('system.hello');
    expect(() => getDeviceTest('missing.test')).toThrow('未知开发板检测');
  });

  it('declares complete shared detection, timeout, wiring, safety and tag contracts', () => {
    for (const test of DEVICE_TESTS) {
      expect(DetectionCheckSchema.safeParse(test.detectionCheck).success, test.id).toBe(true);
      expect(test.timeoutMs, test.id).toBeGreaterThan(0);
      expect(test.firmwareVersion).toBe('device-test-v1');
      expect(test.wiring.length, test.id).toBeGreaterThan(0);
      expect(test.safety.length, test.id).toBeGreaterThan(0);
      expect(test.lessonTagIds.length, test.id).toBeGreaterThan(0);
      expect(test.detectionCheck.evidenceSource, test.id).toBe('device');
      expect(test.detectionCheck.physicalHardware, test.id).toBe(true);
    }
  });

  it('keeps objective values automatic and observed phenomena semi-automatic', () => {
    const semiAutomatic = new Set([
      'exti.event-count',
      'adc.range-dma',
      'rtc.bkp',
      'wdg.reset-cause',
      'pwr.sleep-wake',
    ]);

    for (const test of DEVICE_TESTS) {
      expect(test.detectionCheck.mode, test.id).toBe(
        semiAutomatic.has(test.id) ? 'semi-automatic' : 'automatic',
      );
    }
  });

  it('documents fixed regions and restoration for both flash write tests', () => {
    for (const id of ['spi.flash-roundtrip', 'flash.reserved-page']) {
      const text = [...getDeviceTest(id).wiring, ...getDeviceTest(id).safety].join(' ');
      expect(text, id).toMatch(/保留|固定/);
      expect(text, id).toMatch(/备份/);
      expect(text, id).toMatch(/恢复/);
      expect(text, id).toMatch(/复核|校验/);
    }
  });
});
