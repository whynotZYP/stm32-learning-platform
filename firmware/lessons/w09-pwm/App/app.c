#include "app.h"

#include "pwm_logic.h"
#include "tim.h"

static PwmRampState duty_ramp;

void App_Init(void)
{
  PwmRamp_Init(&duty_ramp, HAL_GetTick());
  __HAL_TIM_ENABLE_OCxPRELOAD(&htim2, TIM_CHANNEL_1);
  __HAL_TIM_SET_COMPARE(&htim2, TIM_CHANNEL_1, duty_ramp.duty_counts);
  if (HAL_TIM_PWM_Start(&htim2, TIM_CHANNEL_1) != HAL_OK) Error_Handler();
}

void App_Run(void)
{
  if (PwmRamp_Update(&duty_ramp, HAL_GetTick()) != 0U) {
    __HAL_TIM_SET_COMPARE(&htim2, TIM_CHANNEL_1, duty_ramp.duty_counts);
  }
}

uint16_t App_DutyCounts(void)
{
  return duty_ramp.duty_counts;
}
