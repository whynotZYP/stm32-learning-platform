#ifndef APP_H
#define APP_H

#include <stdint.h>

#include "w25q64_logic.h"

typedef struct {
  W25Q64_Result result;
  uint8_t jedec_id[3];
  uint8_t test_requested;
  uint8_t test_completed;
  uint32_t elapsed_ms;
} AppFlashState;

void App_Init(void);
void App_Run(void);
void App_RequestFixedSectorTest(void);
AppFlashState App_GetFlashState(void);

#endif
