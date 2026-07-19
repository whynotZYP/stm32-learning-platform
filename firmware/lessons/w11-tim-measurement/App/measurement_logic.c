#include "measurement_logic.h"

enum {
  CAPTURE_CLOCK_HZ = 1000000U,
  CAPTURE_PERIOD_TICKS = 65536U,
  ENCODER_SAMPLE_MS = 100U
};

void MeasurementLogic_Init(MeasurementLogicState *state, uint16_t encoder_count, uint32_t now_ms)
{
  state->capture_overflows = 0U;
  state->high_ticks = 0U;
  state->frequency_hz = 0U;
  state->duty_per_mille = 0U;
  state->encoder_speed_counts_per_second = 0;
  state->previous_encoder_count = encoder_count;
  state->last_encoder_sample_ms = now_ms;
}

void MeasurementLogic_RecordCaptureOverflow(MeasurementLogicState *state)
{
  ++state->capture_overflows;
}

void MeasurementLogic_RecordHighCapture(MeasurementLogicState *state, uint16_t captured_ticks)
{
  state->high_ticks = captured_ticks + (state->capture_overflows * CAPTURE_PERIOD_TICKS);
}

void MeasurementLogic_RecordPeriodCapture(MeasurementLogicState *state, uint16_t captured_ticks)
{
  uint32_t period_ticks = captured_ticks + (state->capture_overflows * CAPTURE_PERIOD_TICKS);
  state->capture_overflows = 0U;
  if ((period_ticks > 0U) && (state->high_ticks <= period_ticks)) {
    state->frequency_hz = CAPTURE_CLOCK_HZ / period_ticks;
    state->duty_per_mille = (uint32_t)(((uint64_t)state->high_ticks * 1000U) / period_ticks);
  }
}

uint8_t MeasurementLogic_SampleEncoder(MeasurementLogicState *state, uint16_t encoder_count, uint32_t now_ms)
{
  uint32_t elapsed_ms = now_ms - state->last_encoder_sample_ms;
  int16_t encoder_delta;
  if (elapsed_ms < ENCODER_SAMPLE_MS) return 0U;

  encoder_delta = (int16_t)(encoder_count - state->previous_encoder_count);
  state->previous_encoder_count = encoder_count;
  state->last_encoder_sample_ms = now_ms;
  state->encoder_speed_counts_per_second = ((int32_t)encoder_delta * 1000) / (int32_t)elapsed_ms;
  return 1U;
}
