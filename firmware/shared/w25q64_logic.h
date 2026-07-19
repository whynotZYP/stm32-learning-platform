#ifndef W25Q64_LOGIC_H
#define W25Q64_LOGIC_H

#include <stdint.h>

#define W25Q64_SECTOR_SIZE 4096U
#define W25Q64_PAGE_SIZE 256U

extern const uint32_t W25Q64_TEST_SECTOR_ADDRESS;

typedef enum {
  W25Q64_RESULT_OK = 0,
  W25Q64_RESULT_IO,
  W25Q64_RESULT_ID,
  W25Q64_RESULT_BOUNDS,
  W25Q64_RESULT_WEL,
  W25Q64_RESULT_TIMEOUT,
  W25Q64_RESULT_VERIFY,
  W25Q64_RESULT_RESTORE_FAILED
} W25Q64_Result;

typedef struct {
  void *context;
  W25Q64_Result (*begin)(void *context);
  W25Q64_Result (*transfer)(void *context, const uint8_t *tx, uint8_t *rx, uint32_t length);
  void (*end)(void *context);
  uint32_t (*now_ms)(void *context);
} W25Q64_Bus;

uint8_t W25Q64_IsPageRangeValid(uint32_t address, uint32_t length);
uint8_t W25Q64_IsExpectedJedecId(const uint8_t id[3]);
W25Q64_Result W25Q64_ReadJedecId(W25Q64_Bus *bus, uint8_t id[3]);
W25Q64_Result W25Q64_WaitReady(W25Q64_Bus *bus, uint32_t timeout_ms);
W25Q64_Result W25Q64_RunFixedSectorTest(W25Q64_Bus *bus, uint8_t backup[W25Q64_SECTOR_SIZE]);

#endif
