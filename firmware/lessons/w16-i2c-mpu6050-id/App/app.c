#include "app.h"

#include "i2c.h"

enum { MPU6050_I2C_TIMEOUT_MS = 20U };

static uint8_t who_am_i;
static Mpu6050IdResult who_am_i_result;

void App_Init(void)
{
  HAL_StatusTypeDef status = HAL_I2C_Mem_Read(
    &hi2c1,
    MPU6050_HAL_ADDRESS,
    MPU6050_WHO_AM_I_REGISTER,
    I2C_MEMADD_SIZE_8BIT,
    &who_am_i,
    1U,
    20U);
  Mpu6050TransportStatus transport = MPU6050_TRANSPORT_ERROR;
  if (status == HAL_OK) transport = MPU6050_TRANSPORT_OK;
  else if (status == HAL_TIMEOUT) transport = MPU6050_TRANSPORT_TIMEOUT;
  who_am_i_result = Mpu6050_ClassifyWhoAmI(transport, who_am_i);
}

void App_Run(void)
{
}

Mpu6050IdResult App_GetWhoAmIResult(void)
{
  return who_am_i_result;
}

uint8_t App_GetWhoAmIValue(void)
{
  return who_am_i;
}
