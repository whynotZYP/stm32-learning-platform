#include "mpu6050_logic.h"

enum {
  ACCEL_LSB_PER_G = 16384,
  GYRO_LSB_PER_DPS = 131,
  ACCEL_LIMIT_MG = 2000,
  GYRO_LIMIT_MDPS = 250000,
  FILTER_DIVISOR = 4
};

static int32_t clamp(int32_t value, int32_t limit)
{
  if (value > limit) return limit;
  if (value < -limit) return -limit;
  return value;
}

int16_t Mpu6050_CombineSigned(uint8_t high, uint8_t low)
{
  const uint16_t combined = ((uint16_t)high << 8U) | (uint16_t)low;
  return (int16_t)combined;
}

void Mpu6050_DecodeFrame(const uint8_t frame[14], Mpu6050RawSample *sample)
{
  for (uint8_t axis = 0U; axis < 3U; ++axis) {
    const uint8_t accel_index = (uint8_t)(axis * 2U);
    const uint8_t gyro_index = (uint8_t)(8U + axis * 2U);
    sample->accel[axis] = Mpu6050_CombineSigned(frame[accel_index], frame[accel_index + 1U]);
    sample->gyro[axis] = Mpu6050_CombineSigned(frame[gyro_index], frame[gyro_index + 1U]);
  }
}

void Mpu6050_Scale(const Mpu6050RawSample *raw, const Mpu6050Bias *bias, Mpu6050ScaledSample *scaled)
{
  for (uint8_t axis = 0U; axis < 3U; ++axis) {
    const int32_t corrected_accel = (int32_t)raw->accel[axis] - bias->accel[axis];
    const int32_t corrected_gyro = (int32_t)raw->gyro[axis] - bias->gyro[axis];
    scaled->accel_mg[axis] = (corrected_accel * 1000) / ACCEL_LSB_PER_G;
    scaled->gyro_mdps[axis] = (corrected_gyro * 1000) / GYRO_LSB_PER_DPS;
  }
}

void Mpu6050_FilterInit(Mpu6050Filter *filter)
{
  filter->initialized = 0U;
  for (uint8_t axis = 0U; axis < 3U; ++axis) {
    filter->output.accel_mg[axis] = 0;
    filter->output.gyro_mdps[axis] = 0;
  }
}

void Mpu6050_FilterUpdate(Mpu6050Filter *filter, const Mpu6050ScaledSample *sample)
{
  for (uint8_t axis = 0U; axis < 3U; ++axis) {
    const int32_t accel = clamp(sample->accel_mg[axis], ACCEL_LIMIT_MG);
    const int32_t gyro = clamp(sample->gyro_mdps[axis], GYRO_LIMIT_MDPS);
    if (!filter->initialized) {
      filter->output.accel_mg[axis] = accel;
      filter->output.gyro_mdps[axis] = gyro;
    } else {
      filter->output.accel_mg[axis] += (accel - filter->output.accel_mg[axis]) / FILTER_DIVISOR;
      filter->output.gyro_mdps[axis] += (gyro - filter->output.gyro_mdps[axis]) / FILTER_DIVISOR;
    }
  }
  filter->initialized = 1U;
}
