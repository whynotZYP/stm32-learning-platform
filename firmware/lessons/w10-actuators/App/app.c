#include "app.h"

#include "actuators.h"

static const uint16_t servo_demo_us[] = {1000U, 1500U, 2000U};
static const int16_t motor_demo[] = {-600, 0, 600};
static uint32_t last_command_ms;
static uint8_t demo_index;

void App_Init(void)
{
  Actuators_Init();
  if (Actuators_SetServoPulseUs(1500U) != HAL_OK) Error_Handler();
  if (Actuators_SetMotorCommand(0) != HAL_OK) Error_Handler();
  last_command_ms = HAL_GetTick();
  demo_index = 0U;
}

void App_Run(void)
{
  uint32_t now = HAL_GetTick();
  if ((uint32_t)(now - last_command_ms) < 2000U) return;
  last_command_ms = now;
  if (Actuators_SetServoPulseUs(servo_demo_us[demo_index]) != HAL_OK) Error_Handler();
  if (Actuators_SetMotorCommand(motor_demo[demo_index]) != HAL_OK) Error_Handler();
  demo_index = (uint8_t)((demo_index + 1U) % 3U);
}
