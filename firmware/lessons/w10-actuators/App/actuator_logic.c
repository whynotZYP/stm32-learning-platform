#include "actuator_logic.h"

ActuatorLogicStatus ActuatorLogic_SetServoPulseUs(const ActuatorIo *io, uint16_t pulse_us)
{
  if (pulse_us < 500U || pulse_us > 2500U) return ACTUATOR_LOGIC_ERROR;
  io->write(io->context, ACTUATOR_SIGNAL_SERVO_COMPARE, pulse_us);
  return ACTUATOR_LOGIC_OK;
}

ActuatorLogicStatus ActuatorLogic_SetMotorCommand(const ActuatorIo *io, int16_t command)
{
  uint16_t magnitude;
  if (command < -1000 || command > 1000) return ACTUATOR_LOGIC_ERROR;

  io->write(io->context, ACTUATOR_SIGNAL_STBY, 0U);
  if (command == 0) {
    io->write(io->context, ACTUATOR_SIGNAL_IN1, 0U);
    io->write(io->context, ACTUATOR_SIGNAL_IN2, 0U);
    io->write(io->context, ACTUATOR_SIGNAL_MOTOR_COMPARE, 0U);
    return ACTUATOR_LOGIC_OK;
  }

  magnitude = (uint16_t)((command > 0) ? command : -command);
  io->write(io->context, ACTUATOR_SIGNAL_IN1, (command > 0) ? 1U : 0U);
  io->write(io->context, ACTUATOR_SIGNAL_IN2, (command > 0) ? 0U : 1U);
  io->write(io->context, ACTUATOR_SIGNAL_MOTOR_COMPARE, (uint16_t)((magnitude * 50U) / 1000U));
  io->write(io->context, ACTUATOR_SIGNAL_STBY, 1U);
  return ACTUATOR_LOGIC_OK;
}
