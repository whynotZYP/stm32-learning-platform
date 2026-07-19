#ifndef ACTUATOR_LOGIC_H
#define ACTUATOR_LOGIC_H

#include <stdint.h>

typedef enum {
  ACTUATOR_SIGNAL_SERVO_COMPARE,
  ACTUATOR_SIGNAL_MOTOR_COMPARE,
  ACTUATOR_SIGNAL_STBY,
  ACTUATOR_SIGNAL_IN1,
  ACTUATOR_SIGNAL_IN2
} ActuatorSignal;

typedef void (*ActuatorWrite)(void *context, ActuatorSignal signal, uint16_t value);

typedef struct {
  ActuatorWrite write;
  void *context;
} ActuatorIo;

typedef enum {
  ACTUATOR_LOGIC_OK,
  ACTUATOR_LOGIC_ERROR
} ActuatorLogicStatus;

ActuatorLogicStatus ActuatorLogic_SetServoPulseUs(const ActuatorIo *io, uint16_t pulse_us);
ActuatorLogicStatus ActuatorLogic_SetMotorCommand(const ActuatorIo *io, int16_t command);

#endif
