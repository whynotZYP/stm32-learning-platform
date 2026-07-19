#ifndef CLOCK_LOGIC_H
#define CLOCK_LOGIC_H

#include <stdint.h>

#define CLOCK_BACKUP_MARKER 0xA55AU

typedef enum {
  CLOCK_COUNTER_HIGH = 0,
  CLOCK_COUNTER_LOW = 1
} ClockCounterPart;

typedef uint16_t (*ClockCounterReader)(void *context, ClockCounterPart part);

uint8_t ClockLogic_NeedsInitialization(uint16_t backup_marker);
uint32_t ClockLogic_ReadCounterConsistent(ClockCounterReader reader, void *context);

#endif
