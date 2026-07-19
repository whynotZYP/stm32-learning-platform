#include "adc_scan_logic.h"

enum {
  ADC_CHANNEL_COUNT = 3U,
  ADC_FULL_SCALE = 4095U,
  ADC_REFERENCE_MV = 3300U
};

void AdcScanLogic_Init(AdcScanLogicState *state)
{
  for (uint8_t index = 0U; index < ADC_CHANNEL_COUNT; ++index) {
    state->raw[index] = 0U;
    state->millivolts[index] = 0U;
  }
  state->rank = 0U;
  state->action = ADC_SCAN_ACTION_DONE;
}

void AdcScanLogic_Begin(AdcScanLogicState *state)
{
  state->rank = 0U;
  state->action = ADC_SCAN_ACTION_START;
}

AdcScanAction AdcScanLogic_CurrentAction(const AdcScanLogicState *state)
{
  return state->action;
}

uint8_t AdcScanLogic_CurrentRank(const AdcScanLogicState *state)
{
  return state->rank;
}

void AdcScanLogic_CompleteAction(AdcScanLogicState *state, uint16_t raw_value)
{
  switch (state->action) {
    case ADC_SCAN_ACTION_START:
      state->action = ADC_SCAN_ACTION_POLL;
      break;
    case ADC_SCAN_ACTION_POLL:
      state->action = ADC_SCAN_ACTION_READ;
      break;
    case ADC_SCAN_ACTION_READ:
      state->raw[state->rank] = raw_value;
      state->millivolts[state->rank] = (uint16_t)(((uint32_t)raw_value * ADC_REFERENCE_MV + 2047U) / ADC_FULL_SCALE);
      ++state->rank;
      state->action = (state->rank < ADC_CHANNEL_COUNT) ? ADC_SCAN_ACTION_START : ADC_SCAN_ACTION_STOP;
      break;
    case ADC_SCAN_ACTION_STOP:
      state->action = ADC_SCAN_ACTION_DONE;
      break;
    case ADC_SCAN_ACTION_DONE:
      break;
  }
}
