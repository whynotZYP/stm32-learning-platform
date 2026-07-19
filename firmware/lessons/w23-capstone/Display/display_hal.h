#ifndef CAPSTONE_DISPLAY_HAL_H
#define CAPSTONE_DISPLAY_HAL_H
#include <stdint.h>
#include "sensors.h"
int DisplayHal_Render(void *context, const SensorSnapshot *snapshot, uint32_t timestamp_utc);
#endif
