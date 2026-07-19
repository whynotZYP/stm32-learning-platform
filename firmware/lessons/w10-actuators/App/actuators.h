#ifndef ACTUATORS_H
#define ACTUATORS_H

#include "main.h"

void Actuators_Init(void);
HAL_StatusTypeDef Actuators_SetServoPulseUs(uint16_t pulse_us);
HAL_StatusTypeDef Actuators_SetMotorCommand(int16_t command);

#endif
