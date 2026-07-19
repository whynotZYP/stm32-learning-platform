#ifndef APP_H
#define APP_H

#include <stdint.h>
#include "reliability_logic.h"

void App_Init(void);
void App_Run(void);
void App_RequestPowerMode(ReliabilityPowerMode mode);
void App_RequestFlashSave(uint32_t value);
void App_RequestWatchdogDemo(void);
void App_ReportExternalProgress(void);

#endif
