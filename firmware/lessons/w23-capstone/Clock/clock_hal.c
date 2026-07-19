#include "clock_hal.h"

#include "rtc.h"

uint32_t ClockHal_UnixUtc(void *context)
{
  uint16_t high_before;
  uint16_t low;
  uint16_t high_after;
  (void)context;
  if (HAL_RTC_WaitForSynchro(&hrtc) != HAL_OK) return 0U;
  do {
    high_before = (uint16_t)hrtc.Instance->CNTH;
    low = (uint16_t)hrtc.Instance->CNTL;
    high_after = (uint16_t)hrtc.Instance->CNTH;
  } while (high_before != high_after);
  return ((uint32_t)high_after << 16U) | low;
}
