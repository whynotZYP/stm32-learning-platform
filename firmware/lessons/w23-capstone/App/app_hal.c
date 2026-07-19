#include "app.h"

#include "adc.h"
#include "app_logic.h"
#include "clock_hal.h"
#include "display_hal.h"
#include "main.h"
#include "sensors_hal.h"
#include "storage_w25q64.h"

#define CAPSTONE_SETTINGS_ADDRESS 0x0800F800UL

static CapstoneAppState capstone;
static IWDG_HandleTypeDef watchdog;
static volatile const uint16_t *const capstone_settings = (const uint16_t *)CAPSTONE_SETTINGS_ADDRESS;

static void FeedWatchdog(void *context)
{
  (void)context;
  if (HAL_IWDG_Refresh(&watchdog) != HAL_OK) Error_Handler();
}

void App_Init(void)
{
  CapstoneAppIo unused_wiring = {SensorsHal_Sample, StorageW25Q64_Append, DisplayHal_Render,
                                 ClockHal_UnixUtc, FeedWatchdog, NULL};
  (void)unused_wiring;
  (void)*capstone_settings;
  if (HAL_ADCEx_Calibration_Start(&hadc1) != HAL_OK) Error_Handler();
  if (SensorsHal_Init() != 0) Error_Handler();
  if (StorageW25Q64_Init() != 0) Error_Handler();
  watchdog.Instance = IWDG;
  watchdog.Init.Prescaler = IWDG_PRESCALER_64;
  watchdog.Init.Reload = 1250U;
  if (HAL_IWDG_Init(&watchdog) != HAL_OK) Error_Handler();
  CapstoneApp_Init(&capstone, 1000U);
}

void App_Run(void)
{
  const CapstoneAppIo io = {SensorsHal_Sample, StorageW25Q64_Append, DisplayHal_Render,
                            ClockHal_UnixUtc, FeedWatchdog, NULL};
  (void)CapstoneApp_Run(&capstone, &io, HAL_GetTick());
}
