#include "app.h"
#include <stdint.h>
#include "tim.h"
static volatile uint32_t milliseconds;
static volatile uint32_t elapsed_seconds;
static uint32_t last_reported_seconds;
static volatile uint16_t external_pulses;
/* TIM2 is the internal 1 ms timebase; TIM3 is reserved for external PA6 pulses. */
void App_Init(void) { milliseconds = 0U; elapsed_seconds = 0U; last_reported_seconds = 0U; }
void App_OnTimerElapsed(void) { if (++milliseconds == 1000U) { milliseconds = 0U; ++elapsed_seconds; } }
void App_Run(void) { uint32_t observed_seconds = elapsed_seconds; external_pulses = __HAL_TIM_GET_COUNTER(&htim3); while (last_reported_seconds != observed_seconds) { ++last_reported_seconds; HAL_GPIO_TogglePin(LED_GPIO_Port, LED_Pin); } }
uint16_t App_ExternalPulseCount(void) { return external_pulses; }
