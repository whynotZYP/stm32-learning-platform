#include "app.h"

#include "main.h"

/*
 * Polarity belongs here, not in generated GPIO code:
 * - the common PC13 board LED sinks current and is active-low;
 * - the external PB0 LED and PB1 driven-buzzer input are active-high.
 */
static const GPIO_PinState LED_ACTIVE_STATE = GPIO_PIN_RESET;
static const GPIO_PinState LED_INACTIVE_STATE = GPIO_PIN_SET;
static const GPIO_PinState LED2_ACTIVE_STATE = GPIO_PIN_SET;
static const GPIO_PinState LED2_INACTIVE_STATE = GPIO_PIN_RESET;
static const GPIO_PinState BUZZER_ACTIVE_STATE = GPIO_PIN_SET;
static const GPIO_PinState BUZZER_INACTIVE_STATE = GPIO_PIN_RESET;

static bool sequence_on;

static GPIO_PinState PinStateFor(bool on, GPIO_PinState active, GPIO_PinState inactive)
{
  return on ? active : inactive;
}

static void App_SetSecondLed(bool on)
{
  HAL_GPIO_WritePin(LED2_GPIO_Port, LED2_Pin,
                    PinStateFor(on, LED2_ACTIVE_STATE, LED2_INACTIVE_STATE));
}

void App_Init(void)
{
  sequence_on = false;
  App_SetLed(false);
  App_SetSecondLed(false);
  App_SetBuzzer(false);
}

void App_SetLed(bool on)
{
  HAL_GPIO_WritePin(LED_GPIO_Port, LED_Pin,
                    PinStateFor(on, LED_ACTIVE_STATE, LED_INACTIVE_STATE));
}

void App_ToggleLed(void)
{
  HAL_GPIO_TogglePin(LED_GPIO_Port, LED_Pin);
}

void App_SetBuzzer(bool on)
{
  HAL_GPIO_WritePin(BUZZER_GPIO_Port, BUZZER_Pin,
                    PinStateFor(on, BUZZER_ACTIVE_STATE, BUZZER_INACTIVE_STATE));
}

void App_Run(void)
{
  sequence_on = !sequence_on;
  App_ToggleLed();
  App_SetSecondLed(!sequence_on);
  App_SetBuzzer(!sequence_on);
  HAL_Delay(500U);
}
