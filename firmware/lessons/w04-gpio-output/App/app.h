#ifndef APP_H
#define APP_H

#include <stdbool.h>

void App_Init(void);
void App_Run(void);
void App_SetLed(bool on);
void App_ToggleLed(void);
void App_SetBuzzer(bool on);

#endif
