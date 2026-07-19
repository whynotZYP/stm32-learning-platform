#include "app.h"

#include "measurement_logic.h"
#include "tim.h"

static MeasurementLogicState measurements;

void App_Init(void)
{
  MeasurementLogic_Init(&measurements, 0U, HAL_GetTick());

  __HAL_TIM_URS_ENABLE(&htim3);
  if (HAL_TIM_PWM_Start(&htim2, TIM_CHANNEL_1) != HAL_OK) Error_Handler();
  if (HAL_TIM_Base_Start_IT(&htim3) != HAL_OK) Error_Handler();
  if (HAL_TIM_IC_Start_IT(&htim3, TIM_CHANNEL_1) != HAL_OK) Error_Handler();
  if (HAL_TIM_IC_Start_IT(&htim3, TIM_CHANNEL_2) != HAL_OK) Error_Handler();
  if (HAL_TIM_Encoder_Start(&htim4, TIM_CHANNEL_ALL) != HAL_OK) Error_Handler();
  measurements.previous_encoder_count = (uint16_t)__HAL_TIM_GET_COUNTER(&htim4);
  measurements.last_encoder_sample_ms = HAL_GetTick();
}

void App_Run(void)
{
  MeasurementLogic_SampleEncoder(&measurements, (uint16_t)__HAL_TIM_GET_COUNTER(&htim4), HAL_GetTick());
}

void HAL_TIM_IC_CaptureCallback(TIM_HandleTypeDef *htim)
{
  if (htim->Instance != TIM3) return;

  if (htim->Channel == HAL_TIM_ACTIVE_CHANNEL_2) {
    MeasurementLogic_RecordHighCapture(&measurements, (uint16_t)HAL_TIM_ReadCapturedValue(htim, TIM_CHANNEL_2));
  } else if (htim->Channel == HAL_TIM_ACTIVE_CHANNEL_1) {
    MeasurementLogic_RecordPeriodCapture(&measurements, (uint16_t)HAL_TIM_ReadCapturedValue(htim, TIM_CHANNEL_1));
  }
}

void HAL_TIM_PeriodElapsedCallback(TIM_HandleTypeDef *htim)
{
  if (htim->Instance == TIM3) MeasurementLogic_RecordCaptureOverflow(&measurements);
}

AppMeasurements App_GetMeasurements(void)
{
  AppMeasurements value;
  value.frequency_hz = measurements.frequency_hz;
  value.duty_per_mille = measurements.duty_per_mille;
  value.encoder_speed_counts_per_second = measurements.encoder_speed_counts_per_second;
  return value;
}
