#ifndef APP_H
#define APP_H

#include "stm32f1xx_hal.h"

void App_Init(void);
void App_Run(void);
void App_OnIrEvent(void);
void App_OnEncoderEvent(GPIO_PinState encoder_b);

#endif
