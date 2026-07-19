#include "i2c_bitbang.h"

static I2cResult wait_scl_high(I2cBitBangBus *bus)
{
  const uint32_t started = bus->now_ticks(bus->context);
  do {
    if (bus->read_scl(bus->context)) return I2C_RESULT_OK;
    bus->step(bus->context);
  } while ((uint32_t)(bus->now_ticks(bus->context) - started) < bus->timeout_ticks);
  return I2C_RESULT_TIMEOUT;
}

static I2cResult start_condition(I2cBitBangBus *bus)
{
  bus->sda_release(bus->context);
  bus->scl_release(bus->context);
  if (wait_scl_high(bus) != I2C_RESULT_OK) return I2C_RESULT_TIMEOUT;
  if (!bus->read_sda(bus->context)) return I2C_RESULT_BUS_STUCK;
  bus->step(bus->context);
  bus->sda_low(bus->context);
  bus->step(bus->context);
  bus->scl_low(bus->context);
  return I2C_RESULT_OK;
}

static I2cResult stop_condition(I2cBitBangBus *bus)
{
  bus->sda_low(bus->context);
  bus->step(bus->context);
  bus->scl_release(bus->context);
  if (wait_scl_high(bus) != I2C_RESULT_OK) return I2C_RESULT_TIMEOUT;
  bus->step(bus->context);
  bus->sda_release(bus->context);
  bus->step(bus->context);
  return bus->read_sda(bus->context) ? I2C_RESULT_OK : I2C_RESULT_BUS_STUCK;
}

I2cResult I2cBitBang_WriteByte(I2cBitBangBus *bus, uint8_t value)
{
  for (uint8_t mask = 0x80U; mask != 0U; mask >>= 1U) {
    bus->scl_low(bus->context);
    if ((value & mask) != 0U) bus->sda_release(bus->context);
    else bus->sda_low(bus->context);
    bus->step(bus->context);
    bus->scl_release(bus->context);
    if (wait_scl_high(bus) != I2C_RESULT_OK) return I2C_RESULT_TIMEOUT;
    bus->step(bus->context);
  }

  bus->scl_low(bus->context);
  bus->sda_release(bus->context);
  bus->step(bus->context);
  bus->scl_release(bus->context);
  if (wait_scl_high(bus) != I2C_RESULT_OK) return I2C_RESULT_TIMEOUT;
  bus->step(bus->context);
  const uint8_t nack = bus->read_sda(bus->context);
  bus->scl_low(bus->context);
  return nack ? I2C_RESULT_NACK : I2C_RESULT_OK;
}

static I2cResult read_byte_with_nack(I2cBitBangBus *bus, uint8_t *value)
{
  uint8_t incoming = 0U;
  bus->sda_release(bus->context);
  for (uint8_t bit = 0U; bit < 8U; ++bit) {
    bus->scl_low(bus->context);
    bus->step(bus->context);
    bus->scl_release(bus->context);
    if (wait_scl_high(bus) != I2C_RESULT_OK) return I2C_RESULT_TIMEOUT;
    incoming = (uint8_t)((incoming << 1U) | (bus->read_sda(bus->context) ? 1U : 0U));
    bus->step(bus->context);
  }
  bus->scl_low(bus->context);
  bus->sda_release(bus->context);
  bus->step(bus->context);
  bus->scl_release(bus->context);
  if (wait_scl_high(bus) != I2C_RESULT_OK) return I2C_RESULT_TIMEOUT;
  bus->step(bus->context);
  bus->scl_low(bus->context);
  *value = incoming;
  return I2C_RESULT_OK;
}

I2cResult I2cBitBang_ReadRegister(I2cBitBangBus *bus, uint8_t address_7bit, uint8_t reg, uint8_t *value)
{
  I2cResult result = start_condition(bus);
  if (result == I2C_RESULT_OK) result = I2cBitBang_WriteByte(bus, (uint8_t)(address_7bit << 1U));
  if (result == I2C_RESULT_OK) result = I2cBitBang_WriteByte(bus, reg);
  if (result == I2C_RESULT_OK) result = start_condition(bus);
  if (result == I2C_RESULT_OK) result = I2cBitBang_WriteByte(bus, (uint8_t)((address_7bit << 1U) | 1U));
  if (result == I2C_RESULT_OK) result = read_byte_with_nack(bus, value);
  const I2cResult stop_result = stop_condition(bus);
  return result == I2C_RESULT_OK ? stop_result : result;
}

I2cResult I2cBitBang_Recover(I2cBitBangBus *bus)
{
  bus->sda_release(bus->context);
  for (uint8_t pulse = 0U; pulse < 9U; ++pulse) {
    bus->scl_low(bus->context);
    bus->step(bus->context);
    bus->scl_release(bus->context);
    if (wait_scl_high(bus) != I2C_RESULT_OK) return I2C_RESULT_BUS_STUCK;
    bus->step(bus->context);
  }
  bus->sda_low(bus->context);
  bus->step(bus->context);
  bus->sda_release(bus->context);
  bus->step(bus->context);
  return bus->read_sda(bus->context) ? I2C_RESULT_OK : I2C_RESULT_BUS_STUCK;
}

I2cRecoveryRead I2cBitBang_ReadRegisterRecovering(I2cBitBangBus *bus, uint8_t address_7bit, uint8_t reg, uint8_t *value)
{
  I2cRecoveryRead attempt = {I2C_RESULT_OK, I2C_RESULT_OK, I2C_RESULT_OK, 0U, 0U};
  attempt.initial_result = I2cBitBang_ReadRegister(bus, address_7bit, reg, value);
  attempt.final_result = attempt.initial_result;
  if (attempt.initial_result != I2C_RESULT_TIMEOUT && attempt.initial_result != I2C_RESULT_BUS_STUCK) return attempt;
  attempt.recovery_attempted = 1U;
  attempt.recovery_result = I2cBitBang_Recover(bus);
  if (attempt.recovery_result == I2C_RESULT_OK) {
    attempt.retried = 1U;
    attempt.final_result = I2cBitBang_ReadRegister(bus, address_7bit, reg, value);
  }
  return attempt;
}
