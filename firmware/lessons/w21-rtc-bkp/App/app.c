#include "app.h"

#include "clock_logic.h"
#include "main.h"
#include "rtc.h"

#define CLOCK_DEFAULT_UNIX_UTC 1704067200UL

static uint32_t unix_utc;

static uint16_t Clock_ReadCounterPart(void *context, ClockCounterPart part)
{
  RTC_HandleTypeDef *rtc = (RTC_HandleTypeDef *)context;
  return (part == CLOCK_COUNTER_HIGH) ? (uint16_t)rtc->Instance->CNTH : (uint16_t)rtc->Instance->CNTL;
}

static int Clock_WaitForWriteComplete(void)
{
  uint32_t started = HAL_GetTick();
  while (READ_BIT(hrtc.Instance->CRL, RTC_CRL_RTOFF) == 0U) {
    if ((HAL_GetTick() - started) >= 100U) return -1;
  }
  return 0;
}

static int Clock_WriteUnixUtc(uint32_t value)
{
  if (Clock_WaitForWriteComplete() != 0) return -1;
  __HAL_RTC_WRITEPROTECTION_DISABLE(&hrtc);
  hrtc.Instance->CNTH = (uint16_t)(value >> 16U);
  hrtc.Instance->CNTL = (uint16_t)value;
  __HAL_RTC_WRITEPROTECTION_ENABLE(&hrtc);
  return Clock_WaitForWriteComplete();
}

void App_Init(void)
{
  uint16_t marker = (uint16_t)HAL_RTCEx_BKUPRead(&hrtc, RTC_BKP_DR1);
  if (ClockLogic_NeedsInitialization(marker) != 0U) {
    /* Preserve the backup domain: initialize only when the marker is absent; never clear the whole domain. */
    if (Clock_WriteUnixUtc(CLOCK_DEFAULT_UNIX_UTC) != 0) Error_Handler();
    HAL_RTCEx_BKUPWrite(&hrtc, RTC_BKP_DR1, CLOCK_BACKUP_MARKER);
  }
  unix_utc = ClockLogic_ReadCounterConsistent(Clock_ReadCounterPart, &hrtc);
}

void App_Run(void)
{
  unix_utc = ClockLogic_ReadCounterConsistent(Clock_ReadCounterPart, &hrtc);
}

uint32_t App_GetUnixUtc(void) { return unix_utc; }
