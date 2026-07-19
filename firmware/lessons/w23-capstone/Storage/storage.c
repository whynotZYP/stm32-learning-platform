#include "storage.h"

#define STORAGE_HEADER_SIZE 12U
#define STORAGE_CHECKSUM_SIZE 4U

static void put_u16(uint8_t *destination, uint16_t value) { destination[0] = (uint8_t)value; destination[1] = (uint8_t)(value >> 8U); }
static void put_u32(uint8_t *destination, uint32_t value) { destination[0] = (uint8_t)value; destination[1] = (uint8_t)(value >> 8U); destination[2] = (uint8_t)(value >> 16U); destination[3] = (uint8_t)(value >> 24U); }
static uint16_t get_u16(const uint8_t *source) { return (uint16_t)(source[0] | ((uint16_t)source[1] << 8U)); }
static uint32_t get_u32(const uint8_t *source) { return (uint32_t)source[0] | ((uint32_t)source[1] << 8U) | ((uint32_t)source[2] << 16U) | ((uint32_t)source[3] << 24U); }

static uint32_t checksum(const uint8_t *data, size_t length)
{
  uint32_t value = 2166136261UL;
  size_t index;
  for (index = 0U; index < length; ++index) value = (value ^ data[index]) * 16777619UL;
  return value;
}

size_t Storage_EncodeRecord(uint8_t *output, size_t capacity, uint32_t timestamp_utc,
                            const uint8_t *payload, uint16_t length)
{
  size_t total = STORAGE_HEADER_SIZE + length + STORAGE_CHECKSUM_SIZE;
  size_t index;
  if ((output == NULL) || (payload == NULL) || (capacity < total)) return 0U;
  put_u32(&output[0], STORAGE_RECORD_MAGIC);
  output[4] = STORAGE_RECORD_VERSION;
  output[5] = 0U;
  put_u16(&output[6], length);
  put_u32(&output[8], timestamp_utc);
  for (index = 0U; index < length; ++index) output[STORAGE_HEADER_SIZE + index] = payload[index];
  put_u32(&output[STORAGE_HEADER_SIZE + length], checksum(output, STORAGE_HEADER_SIZE + length));
  return total;
}

uint8_t Storage_FindNextValidRecord(const uint8_t *log, size_t log_length, size_t start_offset,
                                    StorageRecordView *view)
{
  size_t offset = start_offset;
  if ((log == NULL) || (view == NULL)) return 0U;
  while (offset + STORAGE_HEADER_SIZE + STORAGE_CHECKSUM_SIZE <= log_length) {
    if ((get_u32(&log[offset]) == STORAGE_RECORD_MAGIC) && (log[offset + 4U] == STORAGE_RECORD_VERSION)) {
      uint16_t length = get_u16(&log[offset + 6U]);
      size_t total = STORAGE_HEADER_SIZE + length + STORAGE_CHECKSUM_SIZE;
      if (offset + total > log_length) return 0U;
      if (get_u32(&log[offset + STORAGE_HEADER_SIZE + length]) == checksum(&log[offset], STORAGE_HEADER_SIZE + length)) {
        view->offset = offset;
        view->timestamp_utc = get_u32(&log[offset + 8U]);
        view->length = length;
        return 1U;
      }
      offset += total;
    } else {
      ++offset;
    }
  }
  return 0U;
}
