#ifndef CAPSTONE_STORAGE_W25Q64_H
#define CAPSTONE_STORAGE_W25Q64_H

#include <stdint.h>
#include "sensors.h"

int StorageW25Q64_Init(void);
int StorageW25Q64_Append(void *context, const SensorSnapshot *snapshot, uint32_t timestamp_utc);
int StorageW25Q64_EraseSectorRequested(uint32_t address);

#endif
