#ifndef APP_H
#define APP_H

#include <stdint.h>

void App_Init(void);
void App_Run(void);
void App_OnTimerElapsed(void);
uint16_t App_ExternalPulseCount(void);

#endif
