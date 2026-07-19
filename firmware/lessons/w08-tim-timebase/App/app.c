#include "app.h"
#include <stdint.h>
#include "tim.h"
static volatile uint32_t milliseconds;
static volatile uint32_t seconds;
static volatile uint16_t external_pulses;
/* TIM2 is the internal 1 ms timebase; TIM3 is reserved for external PA6 pulses. */
void App_Init(void) { milliseconds = 0U; seconds = 0U; }
void App_OnTimerElapsed(void) { if (++milliseconds == 1000U) { milliseconds = 0U; ++seconds; } }
void App_Run(void) { external_pulses = __HAL_TIM_GET_COUNTER(&htim3); if (seconds != 0U) { HAL_GPIO_TogglePin(LED_GPIO_Port, LED_Pin); seconds = 0U; } }
uint16_t App_ExternalPulseCount(void) { return external_pulses; }
