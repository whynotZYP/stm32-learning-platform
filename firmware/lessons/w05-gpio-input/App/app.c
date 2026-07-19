#include "app.h"
#include "main.h"

static GPIO_PinState stable_button = GPIO_PIN_SET;
static GPIO_PinState candidate_button = GPIO_PIN_SET;
static uint32_t candidate_since;
static const GPIO_PinState SENSOR_ACTIVE_STATE = GPIO_PIN_SET;
enum { DEBOUNCE_MS = 20U };

void App_Init(void) { stable_button = HAL_GPIO_ReadPin(BUTTON_GPIO_Port, BUTTON_Pin); candidate_button = stable_button; candidate_since = HAL_GetTick(); }
void App_Run(void) {
  GPIO_PinState sample = HAL_GPIO_ReadPin(BUTTON_GPIO_Port, BUTTON_Pin);
  /* The lesson mainline uses an active-high sensor; invert this constant for a verified active-low module. */
  HAL_GPIO_WritePin(BUZZER_GPIO_Port, BUZZER_Pin,
                    HAL_GPIO_ReadPin(SENSOR_GPIO_Port, SENSOR_Pin) == SENSOR_ACTIVE_STATE ? GPIO_PIN_SET : GPIO_PIN_RESET);
  if (sample != candidate_button) { candidate_button = sample; candidate_since = HAL_GetTick(); return; }
  if (candidate_button != stable_button && HAL_GetTick() - candidate_since >= DEBOUNCE_MS) { stable_button = candidate_button; if (stable_button == GPIO_PIN_RESET) HAL_GPIO_TogglePin(LED_GPIO_Port, LED_Pin); }
}
