#include "clock_logic.h"

uint8_t ClockLogic_NeedsInitialization(uint16_t backup_marker)
{
  return (backup_marker == CLOCK_BACKUP_MARKER) ? 0U : 1U;
}

uint32_t ClockLogic_ReadCounterConsistent(ClockCounterReader reader, void *context)
{
  uint16_t high_before;
  uint16_t low;
  uint16_t high_after;

  high_before = reader(context, CLOCK_COUNTER_HIGH);
  low = reader(context, CLOCK_COUNTER_LOW);
  high_after = reader(context, CLOCK_COUNTER_HIGH);
  while (high_before != high_after) {
    high_before = high_after;
    low = reader(context, CLOCK_COUNTER_LOW);
    high_after = reader(context, CLOCK_COUNTER_HIGH);
  }

  return ((uint32_t)high_after << 16U) | low;
}
