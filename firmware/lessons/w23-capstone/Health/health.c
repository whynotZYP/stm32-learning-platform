#include "health.h"

enum { HEALTH_REQUIRED_MASK = HEALTH_PROGRESS_SAMPLE | HEALTH_PROGRESS_STORAGE | HEALTH_PROGRESS_DISPLAY };

void Health_Init(HealthState *state) { state->progress_mask = 0U; }
void Health_ReportProgress(HealthState *state, uint8_t progress) { state->progress_mask |= progress; }
uint8_t Health_TakeFeedPermission(HealthState *state)
{
  if ((state->progress_mask & HEALTH_REQUIRED_MASK) != HEALTH_REQUIRED_MASK) return 0U;
  state->progress_mask = 0U;
  return 1U;
}
