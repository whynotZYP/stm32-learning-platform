#ifndef RELIABILITY_LOGIC_H
#define RELIABILITY_LOGIC_H

#include <stdint.h>

typedef enum {
  RELIABILITY_POWER_SLEEP = 0,
  RELIABILITY_POWER_STOP,
  RELIABILITY_POWER_STANDBY
} ReliabilityPowerMode;

typedef struct {
  uint32_t reset_flags;
  uint8_t standby_wakeup;
  uint8_t wakeup_flag;
  uint8_t progress_pending;
} ReliabilityLogic;

void ReliabilityLogic_Init(ReliabilityLogic *logic, uint32_t reset_flags, uint8_t standby_wakeup, uint8_t wakeup_flag);
void ReliabilityLogic_ReportProgress(ReliabilityLogic *logic);
uint8_t ReliabilityLogic_TakeWatchdogFeed(ReliabilityLogic *logic);
uint8_t ReliabilityLogic_NeedsClockRestore(ReliabilityPowerMode mode);

#endif
