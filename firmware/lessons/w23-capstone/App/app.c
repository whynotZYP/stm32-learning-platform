#include "app_logic.h"

void CapstoneApp_Init(CapstoneAppState *state, uint32_t interval_ms)
{
  state->state = CAPSTONE_STATE_WAIT;
  state->interval_ms = interval_ms;
  state->next_due_ms = interval_ms * 2U;
  state->timestamp_utc = 0U;
  Health_Init(&state->health);
}

uint8_t CapstoneApp_Run(CapstoneAppState *state, const CapstoneAppIo *io, uint32_t now_ms)
{
  if (state->state == CAPSTONE_STATE_WAIT) {
    if ((int32_t)(now_ms - state->next_due_ms) < 0) return 0U;
    state->state = CAPSTONE_STATE_SAMPLE;
  }
  if (state->state == CAPSTONE_STATE_SAMPLE) {
    if (io->sample(io->context, &state->snapshot) != 0) return 0U;
    state->timestamp_utc = io->time_utc(io->context);
    Health_ReportProgress(&state->health, HEALTH_PROGRESS_SAMPLE);
    state->state = CAPSTONE_STATE_STORE;
    return 1U;
  }
  if (state->state == CAPSTONE_STATE_STORE) {
    if (io->store(io->context, &state->snapshot, state->timestamp_utc) != 0) return 0U;
    Health_ReportProgress(&state->health, HEALTH_PROGRESS_STORAGE);
    state->state = CAPSTONE_STATE_DISPLAY;
    return 1U;
  }
  if (io->display(io->context, &state->snapshot, state->timestamp_utc) != 0) return 0U;
  Health_ReportProgress(&state->health, HEALTH_PROGRESS_DISPLAY);
  if (Health_TakeFeedPermission(&state->health) != 0U) io->feed_watchdog(io->context);
  state->next_due_ms += state->interval_ms;
  state->state = CAPSTONE_STATE_WAIT;
  return 1U;
}
