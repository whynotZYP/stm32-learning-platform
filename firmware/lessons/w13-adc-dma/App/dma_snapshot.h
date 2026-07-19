#ifndef DMA_SNAPSHOT_H
#define DMA_SNAPSHOT_H

#include <stdbool.h>
#include <stdint.h>

enum { DMA_SNAPSHOT_CHANNELS = 4U };

typedef struct {
  uint16_t values[DMA_SNAPSHOT_CHANNELS];
  uint32_t sequence;
} DmaSnapshot;

typedef struct {
  volatile uint16_t slots[2U][DMA_SNAPSHOT_CHANNELS];
  volatile uint32_t sequence;
  volatile uint8_t published_slot;
} DmaSnapshotStore;

void DmaSnapshot_Init(DmaSnapshotStore *store);
void DmaSnapshot_Publish(DmaSnapshotStore *store, const uint16_t frame[DMA_SNAPSHOT_CHANNELS]);
bool DmaSnapshot_Read(const DmaSnapshotStore *store, DmaSnapshot *snapshot);

#endif
