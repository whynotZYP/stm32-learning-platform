#ifndef APP_H
#define APP_H

#include <stdint.h>

typedef struct {
  uint16_t raw[3U];
  uint16_t millivolts[3U];
} AppAdcReadings;

void App_Init(void);
void App_Run(void);
AppAdcReadings App_GetAdcReadings(void);

#endif
