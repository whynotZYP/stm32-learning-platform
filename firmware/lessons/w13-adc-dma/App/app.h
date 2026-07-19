#ifndef APP_H
#define APP_H

#include <stdbool.h>

#include "dma_snapshot.h"

void App_Init(void);
void App_Run(void);
bool App_GetAdcSnapshot(DmaSnapshot *snapshot);
bool App_MemoryDmaPassed(void);

#endif
