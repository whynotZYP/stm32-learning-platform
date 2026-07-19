#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "actuator_logic.h"
#include "adc_scan_logic.h"
#include "measurement_logic.h"
#include "pwm_logic.h"

#define CHECK(condition) do { \
  if (!(condition)) { \
    fprintf(stderr, "CHECK failed at line %d: %s\n", __LINE__, #condition); \
    return 1; \
  } \
} while (0)

typedef struct {
  ActuatorSignal signal;
  uint16_t value;
} ActuatorEvent;

typedef struct {
  uint16_t servo_compare;
  uint16_t motor_compare;
  uint16_t stby;
  uint16_t in1;
  uint16_t in2;
  ActuatorEvent events[8];
  uint8_t event_count;
} FakeActuatorOutputs;

static void record_actuator_write(void *context, ActuatorSignal signal, uint16_t value)
{
  FakeActuatorOutputs *outputs = (FakeActuatorOutputs *)context;
  outputs->events[outputs->event_count].signal = signal;
  outputs->events[outputs->event_count].value = value;
  ++outputs->event_count;

  switch (signal) {
    case ACTUATOR_SIGNAL_SERVO_COMPARE: outputs->servo_compare = value; break;
    case ACTUATOR_SIGNAL_MOTOR_COMPARE: outputs->motor_compare = value; break;
    case ACTUATOR_SIGNAL_STBY: outputs->stby = value; break;
    case ACTUATOR_SIGNAL_IN1: outputs->in1 = value; break;
    case ACTUATOR_SIGNAL_IN2: outputs->in2 = value; break;
  }
}

static int test_w09_duty_ramp(void)
{
  PwmRampState state;
  PwmRamp_Init(&state, 1000U);
  CHECK(state.duty_counts == 0U);
  CHECK(PwmRamp_Update(&state, 1099U) == 0U);
  CHECK(state.duty_counts == 0U);

  for (uint32_t step = 1U; step <= 10U; ++step) {
    CHECK(PwmRamp_Update(&state, 1000U + (step * 100U)) == 1U);
    CHECK(state.duty_counts == step * 100U);
  }
  CHECK(PwmRamp_Update(&state, 2100U) == 1U);
  CHECK(state.duty_counts == 900U);
  return 0;
}

static int test_w10_actuator_boundaries_and_order(void)
{
  FakeActuatorOutputs outputs = {1111U, 22U, 1U, 1U, 1U, {{0}}, 0U};
  ActuatorIo io = {record_actuator_write, &outputs};
  FakeActuatorOutputs before = outputs;

  CHECK(ActuatorLogic_SetServoPulseUs(&io, 499U) == ACTUATOR_LOGIC_ERROR);
  CHECK(memcmp(&outputs, &before, sizeof(outputs)) == 0);
  CHECK(ActuatorLogic_SetServoPulseUs(&io, 2501U) == ACTUATOR_LOGIC_ERROR);
  CHECK(memcmp(&outputs, &before, sizeof(outputs)) == 0);
  CHECK(ActuatorLogic_SetMotorCommand(&io, -1001) == ACTUATOR_LOGIC_ERROR);
  CHECK(memcmp(&outputs, &before, sizeof(outputs)) == 0);
  CHECK(ActuatorLogic_SetMotorCommand(&io, 1001) == ACTUATOR_LOGIC_ERROR);
  CHECK(memcmp(&outputs, &before, sizeof(outputs)) == 0);

  CHECK(ActuatorLogic_SetServoPulseUs(&io, 1500U) == ACTUATOR_LOGIC_OK);
  CHECK(outputs.event_count == 1U);
  CHECK(outputs.servo_compare == 1500U);

  outputs.event_count = 0U;
  CHECK(ActuatorLogic_SetMotorCommand(&io, 600) == ACTUATOR_LOGIC_OK);
  CHECK(outputs.event_count == 5U);
  CHECK(outputs.events[0].signal == ACTUATOR_SIGNAL_STBY && outputs.events[0].value == 0U);
  CHECK(outputs.events[1].signal == ACTUATOR_SIGNAL_IN1 && outputs.events[1].value == 1U);
  CHECK(outputs.events[2].signal == ACTUATOR_SIGNAL_IN2 && outputs.events[2].value == 0U);
  CHECK(outputs.events[3].signal == ACTUATOR_SIGNAL_MOTOR_COMPARE && outputs.events[3].value == 30U);
  CHECK(outputs.events[4].signal == ACTUATOR_SIGNAL_STBY && outputs.events[4].value == 1U);

  outputs.event_count = 0U;
  CHECK(ActuatorLogic_SetMotorCommand(&io, -600) == ACTUATOR_LOGIC_OK);
  CHECK(outputs.event_count == 5U);
  CHECK(outputs.events[0].signal == ACTUATOR_SIGNAL_STBY && outputs.events[0].value == 0U);
  CHECK(outputs.events[1].signal == ACTUATOR_SIGNAL_IN1 && outputs.events[1].value == 0U);
  CHECK(outputs.events[2].signal == ACTUATOR_SIGNAL_IN2 && outputs.events[2].value == 1U);
  CHECK(outputs.events[3].signal == ACTUATOR_SIGNAL_MOTOR_COMPARE && outputs.events[3].value == 30U);
  CHECK(outputs.events[4].signal == ACTUATOR_SIGNAL_STBY && outputs.events[4].value == 1U);

  outputs.event_count = 0U;
  CHECK(ActuatorLogic_SetMotorCommand(&io, 0) == ACTUATOR_LOGIC_OK);
  CHECK(outputs.event_count == 4U);
  CHECK(outputs.events[0].signal == ACTUATOR_SIGNAL_STBY && outputs.events[0].value == 0U);
  CHECK(outputs.events[1].signal == ACTUATOR_SIGNAL_IN1 && outputs.events[1].value == 0U);
  CHECK(outputs.events[2].signal == ACTUATOR_SIGNAL_IN2 && outputs.events[2].value == 0U);
  CHECK(outputs.events[3].signal == ACTUATOR_SIGNAL_MOTOR_COMPARE && outputs.events[3].value == 0U);
  CHECK(outputs.stby == 0U && outputs.in1 == 0U && outputs.in2 == 0U && outputs.motor_compare == 0U);
  return 0;
}

static int test_w11_capture_and_encoder_timing(void)
{
  MeasurementLogicState state;
  MeasurementLogic_Init(&state, 65000U, 1000U);

  MeasurementLogic_RecordCaptureOverflow(&state);
  MeasurementLogic_RecordHighCapture(&state, 100U);
  CHECK(state.high_ticks == 65636U);
  MeasurementLogic_RecordCaptureOverflow(&state);
  MeasurementLogic_RecordPeriodCapture(&state, 200U);
  CHECK(state.capture_overflows == 0U);
  CHECK(state.frequency_hz == 7U);
  CHECK(state.duty_per_mille == 500U);

  MeasurementLogic_RecordHighCapture(&state, 350U);
  MeasurementLogic_RecordPeriodCapture(&state, 1000U);
  CHECK(state.frequency_hz == 1000U);
  CHECK(state.duty_per_mille == 350U);

  MeasurementLogic_Init(&state, 65000U, 1000U);
  for (uint8_t overflow = 0U; overflow < 66U; ++overflow) {
    MeasurementLogic_RecordCaptureOverflow(&state);
  }
  MeasurementLogic_RecordHighCapture(&state, 100U);
  MeasurementLogic_RecordCaptureOverflow(&state);
  MeasurementLogic_RecordPeriodCapture(&state, 200U);
  CHECK(state.duty_per_mille == 985U);

  CHECK(MeasurementLogic_SampleEncoder(&state, 100U, 1099U) == 0U);
  CHECK(MeasurementLogic_SampleEncoder(&state, 100U, 1125U) == 1U);
  CHECK(state.encoder_speed_counts_per_second == 5088);
  CHECK(MeasurementLogic_SampleEncoder(&state, 40U, 1325U) == 1U);
  CHECK(state.encoder_speed_counts_per_second == -300);
  return 0;
}

static int test_w12_three_rank_progression(void)
{
  static const AdcScanAction expected_actions[] = {
    ADC_SCAN_ACTION_START, ADC_SCAN_ACTION_POLL, ADC_SCAN_ACTION_READ,
    ADC_SCAN_ACTION_START, ADC_SCAN_ACTION_POLL, ADC_SCAN_ACTION_READ,
    ADC_SCAN_ACTION_START, ADC_SCAN_ACTION_POLL, ADC_SCAN_ACTION_READ,
    ADC_SCAN_ACTION_STOP
  };
  static const uint16_t samples[] = {0U, 2048U, 4095U};
  AdcScanLogicState state;
  uint8_t read_index = 0U;

  AdcScanLogic_Init(&state);
  AdcScanLogic_Begin(&state);
  for (uint8_t index = 0U; index < sizeof(expected_actions) / sizeof(expected_actions[0]); ++index) {
    AdcScanAction action = AdcScanLogic_CurrentAction(&state);
    CHECK(action == expected_actions[index]);
    if (action == ADC_SCAN_ACTION_READ) {
      CHECK(AdcScanLogic_CurrentRank(&state) == read_index);
      AdcScanLogic_CompleteAction(&state, samples[read_index]);
      ++read_index;
    } else {
      AdcScanLogic_CompleteAction(&state, 0U);
    }
  }
  CHECK(AdcScanLogic_CurrentAction(&state) == ADC_SCAN_ACTION_DONE);
  CHECK(read_index == 3U);
  CHECK(state.raw[0] == 0U && state.raw[1] == 2048U && state.raw[2] == 4095U);
  CHECK(state.millivolts[0] == 0U && state.millivolts[1] == 1650U && state.millivolts[2] == 3300U);
  return 0;
}

int main(void)
{
  if (test_w09_duty_ramp() != 0) return 1;
  if (test_w10_actuator_boundaries_and_order() != 0) return 1;
  if (test_w11_capture_and_encoder_timing() != 0) return 1;
  if (test_w12_three_rank_progression() != 0) return 1;
  puts("phase-03 host behavior: PASS");
  return 0;
}
