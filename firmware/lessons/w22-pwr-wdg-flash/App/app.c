#include "app.h"

#include "flash_store.h"
#include "iwdg.h"
#include "main.h"

extern void SystemClock_Config(void);

static ReliabilityLogic reliability;
static FlashStoreWorkspace flash_workspace;
static volatile uint8_t power_request;
static volatile uint8_t flash_request;
static volatile uint8_t watchdog_request;
static uint8_t watchdog_active;
static ReliabilityPowerMode requested_power_mode;
static uint32_t requested_flash_value;

static uint32_t CaptureResetFlags(void)
{
  return RCC->CSR;
}

static void EnterRequestedPowerMode(ReliabilityPowerMode mode)
{
  if (mode == RELIABILITY_POWER_SLEEP) {
    HAL_PWR_EnterSLEEPMode(PWR_MAINREGULATOR_ON, PWR_SLEEPENTRY_WFI);
  } else if (mode == RELIABILITY_POWER_STOP) {
    HAL_PWR_EnterSTOPMode(PWR_LOWPOWERREGULATOR_ON, PWR_STOPENTRY_WFI);
    if (ReliabilityLogic_NeedsClockRestore(mode) != 0U) SystemClock_Config();
  } else {
    HAL_PWR_EnterSTANDBYMode();
  }
}

void App_Init(void)
{
  uint32_t reset_flags = CaptureResetFlags();
  uint8_t standby = (__HAL_PWR_GET_FLAG(PWR_FLAG_SB) != RESET) ? 1U : 0U;
  uint8_t wakeup = (__HAL_PWR_GET_FLAG(PWR_FLAG_WU) != RESET) ? 1U : 0U;
  __HAL_RCC_CLEAR_RESET_FLAGS();
  __HAL_PWR_CLEAR_FLAG(PWR_FLAG_WU | PWR_FLAG_SB);
  ReliabilityLogic_Init(&reliability, reset_flags, standby, wakeup);
  power_request = 0U;
  flash_request = 0U;
  watchdog_request = 0U;
  watchdog_active = 0U;
}

void App_Run(void)
{
  if (flash_request != 0U) {
    uint8_t bytes[4];
    flash_request = 0U;
    bytes[0] = (uint8_t)requested_flash_value;
    bytes[1] = (uint8_t)(requested_flash_value >> 8U);
    bytes[2] = (uint8_t)(requested_flash_value >> 16U);
    bytes[3] = (uint8_t)(requested_flash_value >> 24U);
    if (FlashStoreHal_Update(&flash_workspace, 0U, bytes, sizeof(bytes)) != FLASH_STORE_OK) Error_Handler();
  }
  if (watchdog_request != 0U) {
    if (watchdog_active == 0U) {
      MX_IWDG_Init();
      watchdog_active = 1U;
    }
    if (ReliabilityLogic_TakeWatchdogFeed(&reliability) != 0U) {
      if (HAL_IWDG_Refresh(&hiwdg) != HAL_OK) Error_Handler();
      watchdog_request = 0U;
    }
  }
  if (power_request != 0U) {
    ReliabilityPowerMode mode = requested_power_mode;
    power_request = 0U;
    EnterRequestedPowerMode(mode);
  }
}

void App_RequestPowerMode(ReliabilityPowerMode mode) { requested_power_mode = mode; power_request = 1U; }
void App_RequestFlashSave(uint32_t value) { requested_flash_value = value; flash_request = 1U; }
void App_RequestWatchdogDemo(void) { watchdog_request = 1U; }
void App_ReportExternalProgress(void) { ReliabilityLogic_ReportProgress(&reliability); }
