#ifndef CAPSTONE_APP_LOGIC_H
#define CAPSTONE_APP_LOGIC_H

#include <stdint.h>
#include "health.h"
#include "sensors.h"

typedef enum {
  CAPSTONE_STATE_WAIT = 0,
  CAPSTONE_STATE_SAMPLE,
  CAPSTONE_STATE_STORE,
  CAPSTONE_STATE_DISPLAY
} CapstoneAppMode;

typedef struct {
  CapstoneAppMode state;
  uint32_t interval_ms;
  uint32_t next_due_ms;
  uint32_t timestamp_utc;
  SensorSnapshot snapshot;
  HealthState health;
} CapstoneAppState;

typedef struct {
  int (*sample)(void *context, SensorSnapshot *snapshot);
  int (*store)(void *context, const SensorSnapshot *snapshot, uint32_t timestamp_utc);
  int (*display)(void *context, const SensorSnapshot *snapshot, uint32_t timestamp_utc);
  uint32_t (*time_utc)(void *context);
  void (*feed_watchdog)(void *context);
  void *context;
} CapstoneAppIo;

void CapstoneApp_Init(CapstoneAppState *state, uint32_t interval_ms);
uint8_t CapstoneApp_Run(CapstoneAppState *state, const CapstoneAppIo *io, uint32_t now_ms);

#endif
