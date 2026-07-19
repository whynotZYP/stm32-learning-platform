#include "app.h"

#include "main.h"

void App_Init(void)
{
  /* Common PC13 board LEDs are active-low, so SET is the safe off state. */
  HAL_GPIO_WritePin(LED_GPIO_Port, LED_Pin, GPIO_PIN_SET);
}

void App_Run(void)
{
  HAL_GPIO_TogglePin(LED_GPIO_Port, LED_Pin);
  HAL_Delay(1000U);
}
