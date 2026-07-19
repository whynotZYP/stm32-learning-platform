#ifndef APP_H
#define APP_H

#include <stdint.h>

typedef struct {
  uint32_t frequency_hz;
  uint32_t duty_per_mille;
  int32_t encoder_speed_counts_per_second;
} AppMeasurements;

void App_Init(void);
void App_Run(void);
AppMeasurements App_GetMeasurements(void);

#endif
