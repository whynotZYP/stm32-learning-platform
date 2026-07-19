#ifndef CAPSTONE_SENSORS_HAL_H
#define CAPSTONE_SENSORS_HAL_H

#include "sensors.h"

int SensorsHal_Sample(void *context, SensorSnapshot *snapshot);
int SensorsHal_Init(void);

#endif
