#include "dma_snapshot.h"

void DmaSnapshot_Init(DmaSnapshotStore *store)
{
  uint32_t slot;
  uint32_t channel;
  for (slot = 0U; slot < 2U; ++slot) {
    for (channel = 0U; channel < DMA_SNAPSHOT_CHANNELS; ++channel) store->slots[slot][channel] = 0U;
  }
  store->sequence = 0U;
  store->published_slot = 0U;
}

void DmaSnapshot_Publish(DmaSnapshotStore *store, const uint16_t frame[DMA_SNAPSHOT_CHANNELS])
{
  uint8_t next_slot = (uint8_t)(store->published_slot ^ 1U);
  uint32_t channel;
  for (channel = 0U; channel < DMA_SNAPSHOT_CHANNELS; ++channel) store->slots[next_slot][channel] = frame[channel];
  store->sequence = store->sequence + 1U;
  store->published_slot = next_slot;
}

bool DmaSnapshot_Read(const DmaSnapshotStore *store, DmaSnapshot *snapshot)
{
  uint32_t before = store->sequence;
  uint8_t slot = store->published_slot;
  uint32_t channel;
  if (before == 0U) return false;
  for (channel = 0U; channel < DMA_SNAPSHOT_CHANNELS; ++channel) snapshot->values[channel] = store->slots[slot][channel];
  snapshot->sequence = before;
  return before == store->sequence && slot == store->published_slot;
}
