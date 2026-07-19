#include "app.h"

#include "i2c.h"
#include "main.h"

enum {
  MPU6050_ADDRESS = 0x68U,
  MPU6050_WHO_AM_I = 0x75U,
  HAL_I2C_TIMEOUT_MS = 10U,
  BITBANG_STRETCH_TIMEOUT_MS = 10U,
  BITBANG_HALF_PERIOD_US = 5U
};

static AppI2cComparison comparison;

static void scl_low(void *context) { (void)context; HAL_GPIO_WritePin(GPIOB, GPIO_PIN_6, GPIO_PIN_RESET); }
static void scl_release(void *context) { (void)context; HAL_GPIO_WritePin(GPIOB, GPIO_PIN_6, GPIO_PIN_SET); }
static void sda_low(void *context) { (void)context; HAL_GPIO_WritePin(GPIOB, GPIO_PIN_7, GPIO_PIN_RESET); }
static void sda_release(void *context) { (void)context; HAL_GPIO_WritePin(GPIOB, GPIO_PIN_7, GPIO_PIN_SET); }
static uint8_t read_scl(void *context) { (void)context; return HAL_GPIO_ReadPin(GPIOB, GPIO_PIN_6) == GPIO_PIN_SET; }
static uint8_t read_sda(void *context) { (void)context; return HAL_GPIO_ReadPin(GPIOB, GPIO_PIN_7) == GPIO_PIN_SET; }
static void bus_step(void *context)
{
  (void)context;
  const uint32_t cycles = (SystemCoreClock / 1000000U) * BITBANG_HALF_PERIOD_US;
  const uint32_t started = DWT->CYCCNT;
  while ((uint32_t)(DWT->CYCCNT - started) < cycles) { }
}

static uint32_t bus_now_ticks(void *context)
{
  (void)context;
  return DWT->CYCCNT;
}

static void configure_bitbang_pins(void)
{
  GPIO_InitTypeDef pins = {0};
  HAL_I2C_DeInit(&hi2c1);
  CoreDebug->DEMCR |= CoreDebug_DEMCR_TRCENA_Msk;
  DWT->CYCCNT = 0U;
  DWT->CTRL |= DWT_CTRL_CYCCNTENA_Msk;
  pins.Pin = GPIO_PIN_6 | GPIO_PIN_7;
  pins.Mode = GPIO_MODE_OUTPUT_OD;
  pins.Pull = GPIO_NOPULL;
  pins.Speed = GPIO_SPEED_FREQ_HIGH;
  HAL_GPIO_Init(GPIOB, &pins);
  HAL_GPIO_WritePin(GPIOB, GPIO_PIN_6 | GPIO_PIN_7, GPIO_PIN_SET);
}

static I2cResult classify_hal_result(HAL_StatusTypeDef result)
{
  if (result == HAL_OK) return I2C_RESULT_OK;
  if ((HAL_I2C_GetError(&hi2c1) & HAL_I2C_ERROR_AF) != 0U) return I2C_RESULT_NACK;
  if (result == HAL_TIMEOUT) return I2C_RESULT_TIMEOUT;
  return I2C_RESULT_BUS_STUCK;
}

void App_Init(void)
{
  I2cBitBangBus bus = {
    NULL, scl_low, scl_release, sda_low, sda_release, read_scl, read_sda, bus_step,
    bus_now_ticks, (SystemCoreClock / 1000U) * BITBANG_STRETCH_TIMEOUT_MS
  };
  configure_bitbang_pins();
  const I2cRecoveryRead software = I2cBitBang_ReadRegisterRecovering(&bus, MPU6050_ADDRESS,
    MPU6050_WHO_AM_I, &comparison.software_value);
  comparison.initial_software_result = software.initial_result;
  comparison.recovery_result = software.recovery_result;
  comparison.software_result = software.final_result;
  comparison.recovery_attempted = software.recovery_attempted;
  comparison.software_retried = software.retried;

  HAL_GPIO_DeInit(GPIOB, GPIO_PIN_6 | GPIO_PIN_7);
  MX_I2C1_Init();
  const HAL_StatusTypeDef hardware = HAL_I2C_Mem_Read(&hi2c1, MPU6050_ADDRESS << 1U,
    MPU6050_WHO_AM_I, I2C_MEMADD_SIZE_8BIT, &comparison.hardware_value, 1U, HAL_I2C_TIMEOUT_MS);
  comparison.hardware_result = classify_hal_result(hardware);
}

void App_Run(void)
{
}

AppI2cComparison App_GetI2cComparison(void)
{
  return comparison;
}
