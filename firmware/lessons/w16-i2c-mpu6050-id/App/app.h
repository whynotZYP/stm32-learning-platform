#ifndef APP_H
#define APP_H

#include <stdint.h>

#include "mpu6050_id.h"

void App_Init(void);
void App_Run(void);
Mpu6050IdResult App_GetWhoAmIResult(void);
uint8_t App_GetWhoAmIValue(void);

#endif
