#ifndef CAPSTONE_HEALTH_H
#define CAPSTONE_HEALTH_H

#include <stdint.h>

enum {
  HEALTH_PROGRESS_SAMPLE = 1U,
  HEALTH_PROGRESS_STORAGE = 2U,
  HEALTH_PROGRESS_DISPLAY = 4U
};

typedef struct { uint8_t progress_mask; } HealthState;

void Health_Init(HealthState *state);
void Health_ReportProgress(HealthState *state, uint8_t progress);
uint8_t Health_TakeFeedPermission(HealthState *state);

#endif
