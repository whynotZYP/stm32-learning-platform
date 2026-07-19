#ifndef APP_H
#define APP_H

#include <stdint.h>

void App_Init(void);
void App_Run(void);
uint32_t App_GetRxErrorCount(void);
uint32_t App_GetRxOverrunCount(void);
uint32_t App_GetRxRearmFailureCount(void);

#endif
