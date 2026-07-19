#include "pwm_logic.h"

enum {
  DUTY_STEP = 100U,
  DUTY_MAX = 1000U,
  STEP_INTERVAL_MS = 100U
};

void PwmRamp_Init(PwmRampState *state, uint32_t now_ms)
{
  state->duty_counts = 0U;
  state->direction = 1;
  state->last_step_ms = now_ms;
}

uint8_t PwmRamp_Update(PwmRampState *state, uint32_t now_ms)
{
  if ((uint32_t)(now_ms - state->last_step_ms) < STEP_INTERVAL_MS) return 0U;
  state->last_step_ms = now_ms;

  if (state->direction > 0) {
    state->duty_counts = (uint16_t)(state->duty_counts + DUTY_STEP);
    if (state->duty_counts >= DUTY_MAX) {
      state->duty_counts = DUTY_MAX;
      state->direction = -1;
    }
  } else if (state->duty_counts <= DUTY_STEP) {
    state->duty_counts = 0U;
    state->direction = 1;
  } else {
    state->duty_counts = (uint16_t)(state->duty_counts - DUTY_STEP);
  }
  return 1U;
}
