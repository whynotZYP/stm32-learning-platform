#ifndef PWM_LOGIC_H
#define PWM_LOGIC_H

#include <stdint.h>

typedef struct {
  uint16_t duty_counts;
  int8_t direction;
  uint32_t last_step_ms;
} PwmRampState;

void PwmRamp_Init(PwmRampState *state, uint32_t now_ms);
uint8_t PwmRamp_Update(PwmRampState *state, uint32_t now_ms);

#endif
