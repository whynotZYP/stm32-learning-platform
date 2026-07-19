#include "app.h"

#include "tim.h"

enum {
  CAPTURE_CLOCK_HZ = 1000000U,
  CAPTURE_PERIOD_TICKS = 65536U,
  ENCODER_SAMPLE_MS = 100U
};

static volatile uint32_t capture_overflows;
static volatile uint32_t captured_high_ticks;
static volatile uint32_t frequency_hz;
static volatile uint32_t duty_per_mille;
static volatile int32_t encoder_speed;
static uint16_t previous_encoder_count;
static uint32_t last_encoder_sample_ms;

void App_Init(void)
{
  capture_overflows = 0U;
  captured_high_ticks = 0U;
  frequency_hz = 0U;
  duty_per_mille = 0U;
  encoder_speed = 0;
  previous_encoder_count = 0U;
  last_encoder_sample_ms = HAL_GetTick();

  __HAL_TIM_URS_ENABLE(&htim3);
  if (HAL_TIM_PWM_Start(&htim2, TIM_CHANNEL_1) != HAL_OK) Error_Handler();
  if (HAL_TIM_Base_Start_IT(&htim3) != HAL_OK) Error_Handler();
  if (HAL_TIM_IC_Start_IT(&htim3, TIM_CHANNEL_1) != HAL_OK) Error_Handler();
  if (HAL_TIM_IC_Start_IT(&htim3, TIM_CHANNEL_2) != HAL_OK) Error_Handler();
  if (HAL_TIM_Encoder_Start(&htim4, TIM_CHANNEL_ALL) != HAL_OK) Error_Handler();
  previous_encoder_count = (uint16_t)__HAL_TIM_GET_COUNTER(&htim4);
}

void App_Run(void)
{
  uint32_t now = HAL_GetTick();
  if ((uint32_t)(now - last_encoder_sample_ms) >= ENCODER_SAMPLE_MS) {
    uint16_t current_encoder_count = (uint16_t)__HAL_TIM_GET_COUNTER(&htim4);
    int16_t encoder_delta = (int16_t)(current_encoder_count - previous_encoder_count);
    previous_encoder_count = current_encoder_count;
    last_encoder_sample_ms = now;
    encoder_speed = (int32_t)encoder_delta * 10;
  }
}

void HAL_TIM_IC_CaptureCallback(TIM_HandleTypeDef *htim)
{
  if (htim->Instance != TIM3) return;

  if (htim->Channel == HAL_TIM_ACTIVE_CHANNEL_2) {
    captured_high_ticks = HAL_TIM_ReadCapturedValue(htim, TIM_CHANNEL_2);
  } else if (htim->Channel == HAL_TIM_ACTIVE_CHANNEL_1) {
    uint32_t period_capture = HAL_TIM_ReadCapturedValue(htim, TIM_CHANNEL_1);
    uint32_t period_ticks = period_capture + (capture_overflows * CAPTURE_PERIOD_TICKS);
    capture_overflows = 0U;
    if ((period_ticks > 0U) && (captured_high_ticks <= period_ticks)) {
      frequency_hz = CAPTURE_CLOCK_HZ / period_ticks;
      duty_per_mille = (captured_high_ticks * 1000U) / period_ticks;
    }
  }
}

void HAL_TIM_PeriodElapsedCallback(TIM_HandleTypeDef *htim)
{
  if (htim->Instance == TIM3) ++capture_overflows;
}

AppMeasurements App_GetMeasurements(void)
{
  AppMeasurements value;
  value.frequency_hz = frequency_hz;
  value.duty_per_mille = duty_per_mille;
  value.encoder_speed_counts_per_second = encoder_speed;
  return value;
}
