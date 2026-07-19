#include "app.h"

#include "adc.h"

enum {
  ADC_CHANNEL_COUNT = 3U,
  ADC_FULL_SCALE = 4095U,
  ADC_REFERENCE_MV = 3300U,
  ADC_SAMPLE_INTERVAL_MS = 100U
};

static AppAdcReadings readings;
static uint32_t last_sample_ms;

void App_Init(void)
{
  for (uint32_t index = 0U; index < ADC_CHANNEL_COUNT; ++index) {
    readings.raw[index] = 0U;
    readings.millivolts[index] = 0U;
  }
  if (HAL_ADCEx_Calibration_Start(&hadc1) != HAL_OK) Error_Handler();
  last_sample_ms = HAL_GetTick();
}

void App_Run(void)
{
  uint32_t now = HAL_GetTick();
  if ((uint32_t)(now - last_sample_ms) < ADC_SAMPLE_INTERVAL_MS) return;
  last_sample_ms = now;

  for (uint32_t index = 0U; index < ADC_CHANNEL_COUNT; ++index) {
    uint32_t raw;
    if (HAL_ADC_Start(&hadc1) != HAL_OK) Error_Handler();
    if (HAL_ADC_PollForConversion(&hadc1, 10U) != HAL_OK) Error_Handler();
    raw = HAL_ADC_GetValue(&hadc1);
    readings.raw[index] = (uint16_t)raw;
    readings.millivolts[index] = (uint16_t)((raw * ADC_REFERENCE_MV + 2047U) / ADC_FULL_SCALE);
  }
  if (HAL_ADC_Stop(&hadc1) != HAL_OK) Error_Handler();
}

AppAdcReadings App_GetAdcReadings(void)
{
  return readings;
}
