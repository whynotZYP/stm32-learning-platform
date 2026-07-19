#include "app.h"

#include "adc_scan_logic.h"
#include "adc.h"

enum {
  ADC_SAMPLE_INTERVAL_MS = 100U
};

static AdcScanLogicState scan;
static uint32_t last_sample_ms;

void App_Init(void)
{
  AdcScanLogic_Init(&scan);
  if (HAL_ADCEx_Calibration_Start(&hadc1) != HAL_OK) Error_Handler();
  last_sample_ms = HAL_GetTick();
}

void App_Run(void)
{
  uint32_t now = HAL_GetTick();
  if ((uint32_t)(now - last_sample_ms) < ADC_SAMPLE_INTERVAL_MS) return;
  last_sample_ms = now;

  AdcScanLogic_Begin(&scan);
  while (AdcScanLogic_CurrentAction(&scan) != ADC_SCAN_ACTION_DONE) {
    uint16_t raw = 0U;
    switch (AdcScanLogic_CurrentAction(&scan)) {
      case ADC_SCAN_ACTION_START:
        if (HAL_ADC_Start(&hadc1) != HAL_OK) Error_Handler();
        break;
      case ADC_SCAN_ACTION_POLL:
        if (HAL_ADC_PollForConversion(&hadc1, 10U) != HAL_OK) Error_Handler();
        break;
      case ADC_SCAN_ACTION_READ:
        raw = (uint16_t)HAL_ADC_GetValue(&hadc1);
        break;
      case ADC_SCAN_ACTION_STOP:
        if (HAL_ADC_Stop(&hadc1) != HAL_OK) Error_Handler();
        break;
      case ADC_SCAN_ACTION_DONE:
        break;
    }
    AdcScanLogic_CompleteAction(&scan, raw);
  }
}

AppAdcReadings App_GetAdcReadings(void)
{
  AppAdcReadings readings;
  for (uint8_t index = 0U; index < 3U; ++index) {
    readings.raw[index] = scan.raw[index];
    readings.millivolts[index] = scan.millivolts[index];
  }
  return readings;
}
