#ifndef MEASUREMENT_LOGIC_H
#define MEASUREMENT_LOGIC_H

#include <stdint.h>

typedef struct {
  uint32_t capture_overflows;
  uint32_t high_ticks;
  uint32_t frequency_hz;
  uint32_t duty_per_mille;
  int32_t encoder_speed_counts_per_second;
  uint16_t previous_encoder_count;
  uint32_t last_encoder_sample_ms;
} MeasurementLogicState;

void MeasurementLogic_Init(MeasurementLogicState *state, uint16_t encoder_count, uint32_t now_ms);
void MeasurementLogic_RecordCaptureOverflow(MeasurementLogicState *state);
void MeasurementLogic_RecordHighCapture(MeasurementLogicState *state, uint16_t captured_ticks);
void MeasurementLogic_RecordPeriodCapture(MeasurementLogicState *state, uint16_t captured_ticks);
uint8_t MeasurementLogic_SampleEncoder(MeasurementLogicState *state, uint16_t encoder_count, uint32_t now_ms);

#endif
