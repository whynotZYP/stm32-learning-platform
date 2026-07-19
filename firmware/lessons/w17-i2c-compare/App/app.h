#ifndef APP_H
#define APP_H

#include <stdint.h>

#include "i2c_bitbang.h"

typedef struct {
  I2cResult initial_software_result;
  I2cResult recovery_result;
  I2cResult software_result;
  I2cResult hardware_result;
  uint8_t recovery_attempted;
  uint8_t software_retried;
  uint8_t software_value;
  uint8_t hardware_value;
} AppI2cComparison;

void App_Init(void);
void App_Run(void);
AppI2cComparison App_GetI2cComparison(void);

#endif
