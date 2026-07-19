#include "sensors_hal.h"

#include "adc.h"
#include "i2c.h"

#define MPU6050_ADDRESS (0x68U << 1U)
#define MPU6050_ACCEL_XOUT_H 0x3BU
#define MPU6050_PWR_MGMT_1 0x6BU
#define MPU6050_WHO_AM_I 0x75U
#define MPU6050_WHO_AM_I_VALUE 0x68U

static int SensorsHal_ReadAdcPair(uint16_t *light, uint16_t *temperature)
{
  int result = -1;
  if (HAL_ADC_Start(&hadc1) != HAL_OK) return -1;
  if (HAL_ADC_PollForConversion(&hadc1, 10U) != HAL_OK) goto stop_adc;
  *light = (uint16_t)HAL_ADC_GetValue(&hadc1);
  if (HAL_ADC_Start(&hadc1) != HAL_OK) goto stop_adc;
  if (HAL_ADC_PollForConversion(&hadc1, 10U) != HAL_OK) goto stop_adc;
  *temperature = (uint16_t)HAL_ADC_GetValue(&hadc1);
  result = 0;
stop_adc:
  if (HAL_ADC_Stop(&hadc1) != HAL_OK) result = -1;
  return result;
}

int SensorsHal_Init(void)
{
  uint8_t who_am_i = 0U;
  uint8_t wake = 0U;
  if (HAL_I2C_Mem_Read(&hi2c1, MPU6050_ADDRESS, MPU6050_WHO_AM_I,
                       I2C_MEMADD_SIZE_8BIT, &who_am_i, 1U, 20U) != HAL_OK) return -1;
  if (who_am_i != MPU6050_WHO_AM_I_VALUE) return -1;
  return (HAL_I2C_Mem_Write(&hi2c1, MPU6050_ADDRESS, MPU6050_PWR_MGMT_1,
                            I2C_MEMADD_SIZE_8BIT, &wake, 1U, 20U) == HAL_OK) ? 0 : -1;
}

int SensorsHal_Sample(void *context, SensorSnapshot *snapshot)
{
  uint8_t motion[6];
  (void)context;
  if (SensorsHal_ReadAdcPair(&snapshot->light_raw, &snapshot->temperature_raw) != 0) return -1;
  if (HAL_I2C_Mem_Read(&hi2c1, MPU6050_ADDRESS, MPU6050_ACCEL_XOUT_H,
                       I2C_MEMADD_SIZE_8BIT, motion, sizeof(motion), 20U) != HAL_OK) return -1;
  snapshot->motion_x = (int16_t)(((uint16_t)motion[0] << 8U) | motion[1]);
  snapshot->motion_y = (int16_t)(((uint16_t)motion[2] << 8U) | motion[3]);
  snapshot->motion_z = (int16_t)(((uint16_t)motion[4] << 8U) | motion[5]);
  return 0;
}
