#include "actuators.h"

#include "actuator_logic.h"
#include "tim.h"

static void write_actuator_output(void *context, ActuatorSignal signal, uint16_t value)
{
  GPIO_PinState pin_state = (value != 0U) ? GPIO_PIN_SET : GPIO_PIN_RESET;
  (void)context;

  switch (signal) {
    case ACTUATOR_SIGNAL_SERVO_COMPARE:
      __HAL_TIM_SET_COMPARE(&htim2, TIM_CHANNEL_1, value);
      break;
    case ACTUATOR_SIGNAL_MOTOR_COMPARE:
      __HAL_TIM_SET_COMPARE(&htim3, TIM_CHANNEL_1, value);
      break;
    case ACTUATOR_SIGNAL_STBY:
      HAL_GPIO_WritePin(MOTOR_STBY_GPIO_Port, MOTOR_STBY_Pin, pin_state);
      break;
    case ACTUATOR_SIGNAL_IN1:
      HAL_GPIO_WritePin(MOTOR_IN1_GPIO_Port, MOTOR_IN1_Pin, pin_state);
      break;
    case ACTUATOR_SIGNAL_IN2:
      HAL_GPIO_WritePin(MOTOR_IN2_GPIO_Port, MOTOR_IN2_Pin, pin_state);
      break;
  }
}

static const ActuatorIo actuator_io = {write_actuator_output, 0};

void Actuators_Init(void)
{
  HAL_GPIO_WritePin(MOTOR_STBY_GPIO_Port, MOTOR_STBY_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(MOTOR_IN1_GPIO_Port, MOTOR_IN1_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(MOTOR_IN2_GPIO_Port, MOTOR_IN2_Pin, GPIO_PIN_RESET);
  if (HAL_TIM_PWM_Start(&htim2, TIM_CHANNEL_1) != HAL_OK) Error_Handler();
  if (HAL_TIM_PWM_Start(&htim3, TIM_CHANNEL_1) != HAL_OK) Error_Handler();
}

HAL_StatusTypeDef Actuators_SetServoPulseUs(uint16_t pulse_us)
{
  return (ActuatorLogic_SetServoPulseUs(&actuator_io, pulse_us) == ACTUATOR_LOGIC_OK) ? HAL_OK : HAL_ERROR;
}

HAL_StatusTypeDef Actuators_SetMotorCommand(int16_t command)
{
  return (ActuatorLogic_SetMotorCommand(&actuator_io, command) == ACTUATOR_LOGIC_OK) ? HAL_OK : HAL_ERROR;
}
