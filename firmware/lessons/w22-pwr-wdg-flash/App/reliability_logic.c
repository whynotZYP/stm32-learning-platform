#include "reliability_logic.h"

void ReliabilityLogic_Init(ReliabilityLogic *logic, uint32_t reset_flags, uint8_t standby_wakeup, uint8_t wakeup_flag)
{
  logic->reset_flags = reset_flags;
  logic->standby_wakeup = standby_wakeup;
  logic->wakeup_flag = wakeup_flag;
  logic->progress_pending = 0U;
}

void ReliabilityLogic_ReportProgress(ReliabilityLogic *logic)
{
  logic->progress_pending = 1U;
}

uint8_t ReliabilityLogic_TakeWatchdogFeed(ReliabilityLogic *logic)
{
  uint8_t permission = logic->progress_pending;
  logic->progress_pending = 0U;
  return permission;
}

uint8_t ReliabilityLogic_NeedsClockRestore(ReliabilityPowerMode mode)
{
  return (mode == RELIABILITY_POWER_STOP) ? 1U : 0U;
}
