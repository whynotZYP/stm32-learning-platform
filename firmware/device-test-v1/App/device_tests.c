#include "device_tests.h"

#include <string.h>

static const char *const DEVICE_TEST_IDS[] = {
  "system.hello",
  "system.chip-id",
  "gpio.loopback",
  "exti.event-count",
  "tim.pwm-capture",
  "adc.range-dma",
  "dma.memory-copy",
  "usart.packet",
  "i2c.mpu6050-id",
  "spi.flash-id",
  "spi.flash-roundtrip",
  "rtc.bkp",
  "wdg.reset-cause",
  "flash.reserved-page",
  "pwr.sleep-wake"
};

size_t DeviceTests_Count(void)
{
  return sizeof(DEVICE_TEST_IDS) / sizeof(DEVICE_TEST_IDS[0]);
}

const char *DeviceTests_IdAt(size_t index)
{
  return index < DeviceTests_Count() ? DEVICE_TEST_IDS[index] : NULL;
}

int DeviceTests_IsKnown(const char *test_id)
{
  size_t index;

  if (test_id == NULL) {
    return 0;
  }
  for (index = 0U; index < DeviceTests_Count(); ++index) {
    if (strcmp(test_id, DEVICE_TEST_IDS[index]) == 0) {
      return 1;
    }
  }
  return 0;
}
