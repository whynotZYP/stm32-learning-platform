#include "app.h"

#include "tim.h"

enum {
  DUTY_STEP = 100U,
  DUTY_MAX = 1000U,
  STEP_INTERVAL_MS = 100U
};

static uint16_t duty_counts;
static int16_t duty_direction;
static uint32_t last_step_ms;

void App_Init(void)
{
  duty_counts = 0U;
  duty_direction = 1;
  last_step_ms = HAL_GetTick();
  __HAL_TIM_ENABLE_OCxPRELOAD(&htim2, TIM_CHANNEL_1);
  __HAL_TIM_SET_COMPARE(&htim2, TIM_CHANNEL_1, duty_counts);
  if (HAL_TIM_PWM_Start(&htim2, TIM_CHANNEL_1) != HAL_OK) Error_Handler();
}

void App_Run(void)
{
  uint32_t now = HAL_GetTick();
  if ((uint32_t)(now - last_step_ms) < STEP_INTERVAL_MS) return;
  last_step_ms = now;

  if (duty_direction > 0) {
    duty_counts = (uint16_t)(duty_counts + DUTY_STEP);
    if (duty_counts >= DUTY_MAX) {
      duty_counts = DUTY_MAX;
      duty_direction = -1;
    }
  } else if (duty_counts <= DUTY_STEP) {
    duty_counts = 0U;
    duty_direction = 1;
  } else {
    duty_counts = (uint16_t)(duty_counts - DUTY_STEP);
  }

  __HAL_TIM_SET_COMPARE(&htim2, TIM_CHANNEL_1, duty_counts);
}

uint16_t App_DutyCounts(void)
{
  return duty_counts;
}
