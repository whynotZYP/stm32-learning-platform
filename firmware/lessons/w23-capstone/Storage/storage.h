#ifndef CAPSTONE_STORAGE_H
#define CAPSTONE_STORAGE_H

#include <stddef.h>
#include <stdint.h>

#define STORAGE_RECORD_MAGIC 0x31474F4CUL
#define STORAGE_RECORD_VERSION 1U

typedef struct {
  size_t offset;
  uint32_t timestamp_utc;
  uint16_t length;
} StorageRecordView;

size_t Storage_EncodeRecord(uint8_t *output, size_t capacity, uint32_t timestamp_utc,
                            const uint8_t *payload, uint16_t length);
uint8_t Storage_FindNextValidRecord(const uint8_t *log, size_t log_length, size_t start_offset,
                                    StorageRecordView *view);

#endif
