#include "app.h"
#include "main.h"

static GPIO_PinState stable_button = GPIO_PIN_SET;
static uint8_t same_samples;

void App_Init(void) { stable_button = HAL_GPIO_ReadPin(BUTTON_GPIO_Port, BUTTON_Pin); same_samples = 0U; }
void App_Run(void) {
  GPIO_PinState sample = HAL_GPIO_ReadPin(BUTTON_GPIO_Port, BUTTON_Pin);
  /* The documented active-high buzzer module is safe-low until its sensor input is active. */
  HAL_GPIO_WritePin(BUZZER_GPIO_Port, BUZZER_Pin,
                    HAL_GPIO_ReadPin(SENSOR_GPIO_Port, SENSOR_Pin) == GPIO_PIN_SET ? GPIO_PIN_SET : GPIO_PIN_RESET);
  if (sample == stable_button) { same_samples = 0U; return; }
  if (++same_samples >= 4U) { stable_button = sample; same_samples = 0U; if (sample == GPIO_PIN_RESET) HAL_GPIO_TogglePin(LED_GPIO_Port, LED_Pin); }
}
