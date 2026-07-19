#ifndef CAPSTONE_SENSORS_H
#define CAPSTONE_SENSORS_H

#include <stdint.h>

typedef struct {
  uint16_t light_raw;
  uint16_t temperature_raw;
  int16_t motion_x;
  int16_t motion_y;
  int16_t motion_z;
} SensorSnapshot;

typedef struct { SensorSnapshot latest; } SensorsState;

void Sensors_Init(SensorsState *state);
void Sensors_Commit(SensorsState *state, const SensorSnapshot *snapshot);

#endif
