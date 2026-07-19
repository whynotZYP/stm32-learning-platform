#ifndef I2C_BITBANG_H
#define I2C_BITBANG_H

#include <stdint.h>

typedef enum {
  I2C_RESULT_OK = 0,
  I2C_RESULT_TIMEOUT,
  I2C_RESULT_NACK,
  I2C_RESULT_BUS_STUCK
} I2cResult;

typedef struct {
  void *context;
  void (*scl_low)(void *context);
  void (*scl_release)(void *context);
  void (*sda_low)(void *context);
  void (*sda_release)(void *context);
  uint8_t (*read_scl)(void *context);
  uint8_t (*read_sda)(void *context);
  void (*step)(void *context);
  uint32_t (*now_ticks)(void *context);
  uint32_t timeout_ticks;
} I2cBitBangBus;

typedef struct {
  I2cResult initial_result;
  I2cResult recovery_result;
  I2cResult final_result;
  uint8_t recovery_attempted;
  uint8_t retried;
} I2cRecoveryRead;

I2cResult I2cBitBang_WriteByte(I2cBitBangBus *bus, uint8_t value);
I2cResult I2cBitBang_ReadRegister(I2cBitBangBus *bus, uint8_t address_7bit, uint8_t reg, uint8_t *value);
I2cResult I2cBitBang_Recover(I2cBitBangBus *bus);
I2cRecoveryRead I2cBitBang_ReadRegisterRecovering(I2cBitBangBus *bus, uint8_t address_7bit, uint8_t reg, uint8_t *value);

#endif
