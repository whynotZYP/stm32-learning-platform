#ifndef APP_H
#define APP_H

#include <stdint.h>

#include "mpu6050_logic.h"

typedef struct {
  uint8_t who_am_i;
  uint8_t ready;
  uint8_t last_hal_status;
  Mpu6050RawSample raw;
  Mpu6050ScaledSample scaled;
  Mpu6050ScaledSample filtered;
} AppMpu6050State;

void App_Init(void);
void App_Run(void);
AppMpu6050State App_GetMpu6050State(void);

#endif
