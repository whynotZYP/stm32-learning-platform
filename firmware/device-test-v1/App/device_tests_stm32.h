#ifndef DEVICE_TESTS_STM32_H
#define DEVICE_TESTS_STM32_H

typedef enum {
  DEVICE_TEST_PASS = 0,
  DEVICE_TEST_FAIL,
  DEVICE_TEST_PRECONDITION,
  DEVICE_TEST_TIMEOUT,
  DEVICE_TEST_HARDWARE
} DeviceTestStatus;

typedef struct {
  DeviceTestStatus status;
  char details[192];
  const char *message;
} DeviceTestOutcome;

void DeviceTestsStm32_Init(void);
DeviceTestOutcome DeviceTestsStm32_Run(const char *test_id);

#endif
