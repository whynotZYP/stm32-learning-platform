#ifndef FLASH_STORE_H
#define FLASH_STORE_H

#include <stddef.h>
#include <stdint.h>

#define FLASH_STORE_PAGE_ADDRESS 0x0800FC00UL
#define FLASH_STORE_PAGE_HALFWORDS 512U

typedef enum {
  FLASH_STORE_OK = 0,
  FLASH_STORE_ERROR,
  FLASH_STORE_RESTORE_FAILED,
  FLASH_STORE_INVALID_ARGUMENT
} FlashStoreStatus;

typedef struct {
  uint16_t old_page[FLASH_STORE_PAGE_HALFWORDS];
  uint16_t new_page[FLASH_STORE_PAGE_HALFWORDS];
} FlashStoreWorkspace;

typedef struct {
  uint16_t (*read)(void *context, uint16_t index);
  int (*unlock)(void *context);
  int (*erase)(void *context);
  int (*program)(void *context, uint16_t index, uint16_t value);
  void (*lock)(void *context);
  void *context;
} FlashStoreIo;

FlashStoreStatus FlashStore_Update(const FlashStoreIo *io, FlashStoreWorkspace *workspace,
                                   uint16_t byte_offset, const uint8_t *payload, size_t length);
FlashStoreStatus FlashStoreHal_Update(FlashStoreWorkspace *workspace, uint16_t byte_offset,
                                      const uint8_t *payload, size_t length);

#endif
