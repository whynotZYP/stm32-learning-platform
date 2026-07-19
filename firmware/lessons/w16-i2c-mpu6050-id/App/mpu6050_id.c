#include "mpu6050_id.h"

Mpu6050IdResult Mpu6050_ClassifyWhoAmI(Mpu6050TransportStatus status, uint8_t id)
{
  if (status == MPU6050_TRANSPORT_TIMEOUT) return MPU6050_ID_TIMEOUT;
  if (status != MPU6050_TRANSPORT_OK) return MPU6050_ID_BUS_ERROR;
  return id == MPU6050_EXPECTED_ID ? MPU6050_ID_OK : MPU6050_ID_WRONG;
}
