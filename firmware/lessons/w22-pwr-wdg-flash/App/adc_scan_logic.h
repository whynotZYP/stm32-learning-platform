#ifndef ADC_SCAN_LOGIC_H
#define ADC_SCAN_LOGIC_H

#include <stdint.h>

typedef enum {
  ADC_SCAN_ACTION_START,
  ADC_SCAN_ACTION_POLL,
  ADC_SCAN_ACTION_READ,
  ADC_SCAN_ACTION_STOP,
  ADC_SCAN_ACTION_DONE
} AdcScanAction;

typedef struct {
  uint16_t raw[3U];
  uint16_t millivolts[3U];
  uint8_t rank;
  AdcScanAction action;
} AdcScanLogicState;

void AdcScanLogic_Init(AdcScanLogicState *state);
void AdcScanLogic_Begin(AdcScanLogicState *state);
AdcScanAction AdcScanLogic_CurrentAction(const AdcScanLogicState *state);
uint8_t AdcScanLogic_CurrentRank(const AdcScanLogicState *state);
void AdcScanLogic_CompleteAction(AdcScanLogicState *state, uint16_t raw_value);

#endif
