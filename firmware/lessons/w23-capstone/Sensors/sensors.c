#include "sensors.h"

void Sensors_Init(SensorsState *state)
{
  SensorSnapshot empty = {0U, 0U, 0, 0, 0};
  state->latest = empty;
}

void Sensors_Commit(SensorsState *state, const SensorSnapshot *snapshot)
{
  state->latest = *snapshot;
}
