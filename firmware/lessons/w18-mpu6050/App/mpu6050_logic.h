#ifndef MPU6050_LOGIC_H
#define MPU6050_LOGIC_H

#include <stdint.h>

typedef struct {
  int16_t accel[3];
  int16_t gyro[3];
} Mpu6050RawSample;

typedef struct {
  int16_t accel[3];
  int16_t gyro[3];
} Mpu6050Bias;

typedef struct {
  int32_t accel_mg[3];
  int32_t gyro_mdps[3];
} Mpu6050ScaledSample;

typedef struct {
  Mpu6050ScaledSample output;
  uint8_t initialized;
} Mpu6050Filter;

int16_t Mpu6050_CombineSigned(uint8_t high, uint8_t low);
void Mpu6050_DecodeFrame(const uint8_t frame[14], Mpu6050RawSample *sample);
void Mpu6050_Scale(const Mpu6050RawSample *raw, const Mpu6050Bias *bias, Mpu6050ScaledSample *scaled);
void Mpu6050_FilterInit(Mpu6050Filter *filter);
void Mpu6050_FilterUpdate(Mpu6050Filter *filter, const Mpu6050ScaledSample *sample);

#endif
