#include "app.h"

#include "i2c.h"
#include "main.h"

enum {
  MPU6050_ADDRESS = 0x68U << 1U,
  MPU6050_WHO_AM_I_REGISTER = 0x75U,
  MPU6050_PWR_MGMT_1_REGISTER = 0x6BU,
  MPU6050_ACCEL_XOUT_H_REGISTER = 0x3BU,
  MPU6050_EXPECTED_ID = 0x68U,
  MPU6050_TIMEOUT_MS = 10U,
  MPU6050_SAMPLE_INTERVAL_MS = 20U
};

static AppMpu6050State state;
static Mpu6050Filter filter;
static uint32_t last_sample_ms;
static const Mpu6050Bias bias = {{0, 0, 0}, {0, 0, 0}};

void App_Init(void)
{
  uint8_t wake = 0U;
  Mpu6050_FilterInit(&filter);
  state.last_hal_status = (uint8_t)HAL_I2C_Mem_Write(&hi2c1, MPU6050_ADDRESS,
    MPU6050_PWR_MGMT_1_REGISTER, I2C_MEMADD_SIZE_8BIT, &wake, 1U, MPU6050_TIMEOUT_MS);
  if (state.last_hal_status == (uint8_t)HAL_OK) {
    state.last_hal_status = (uint8_t)HAL_I2C_Mem_Read(&hi2c1, MPU6050_ADDRESS,
      MPU6050_WHO_AM_I_REGISTER, I2C_MEMADD_SIZE_8BIT, &state.who_am_i, 1U, MPU6050_TIMEOUT_MS);
  }
  state.ready = state.last_hal_status == (uint8_t)HAL_OK && state.who_am_i == MPU6050_EXPECTED_ID;
  last_sample_ms = HAL_GetTick();
}

void App_Run(void)
{
  uint8_t frame[14];
  const uint32_t now = HAL_GetTick();
  if (!state.ready || (uint32_t)(now - last_sample_ms) < MPU6050_SAMPLE_INTERVAL_MS) return;
  last_sample_ms = now;
  state.last_hal_status = (uint8_t)HAL_I2C_Mem_Read(&hi2c1, MPU6050_ADDRESS,
    MPU6050_ACCEL_XOUT_H_REGISTER, I2C_MEMADD_SIZE_8BIT, frame, sizeof(frame), MPU6050_TIMEOUT_MS);
  if (state.last_hal_status != (uint8_t)HAL_OK) return;
  Mpu6050_DecodeFrame(frame, &state.raw);
  Mpu6050_Scale(&state.raw, &bias, &state.scaled);
  Mpu6050_FilterUpdate(&filter, &state.scaled);
  state.filtered = filter.output;
}

AppMpu6050State App_GetMpu6050State(void)
{
  return state;
}
