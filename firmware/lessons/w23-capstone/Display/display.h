#ifndef CAPSTONE_DISPLAY_H
#define CAPSTONE_DISPLAY_H

#include <stdint.h>
#include "sensors.h"

typedef struct { uint32_t render_count; } DisplayState;

void Display_Init(DisplayState *state);
void Display_Commit(DisplayState *state, const SensorSnapshot *snapshot, uint32_t timestamp_utc);

#endif
