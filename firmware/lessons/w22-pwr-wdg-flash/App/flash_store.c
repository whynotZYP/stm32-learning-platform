#include "flash_store.h"

static uint8_t FlashStore_ReadbackMatches(const FlashStoreIo *io, const uint16_t *expected)
{
  uint16_t index;
  for (index = 0U; index < FLASH_STORE_PAGE_HALFWORDS; ++index) {
    if (io->read(io->context, index) != expected[index]) return 0U;
  }
  return 1U;
}

static uint8_t FlashStore_ProgramPage(const FlashStoreIo *io, const uint16_t *page)
{
  uint16_t index;
  for (index = 0U; index < FLASH_STORE_PAGE_HALFWORDS; ++index) {
    if (io->program(io->context, index, page[index]) != 0) return 0U;
  }
  return FlashStore_ReadbackMatches(io, page);
}

static uint8_t FlashStore_Restore(const FlashStoreIo *io, const uint16_t *old_page)
{
  /* Restore always uses a page erase, halfword programming, readback and timeout/error result from the adapter. */
  if (io->erase(io->context) != 0) return 0U;
  return FlashStore_ProgramPage(io, old_page);
}

FlashStoreStatus FlashStore_Update(const FlashStoreIo *io, FlashStoreWorkspace *workspace,
                                   uint16_t byte_offset, const uint8_t *payload, size_t length)
{
  FlashStoreStatus result = FLASH_STORE_OK;
  uint16_t index;
  size_t byte_index;

  if ((io == NULL) || (workspace == NULL) || (payload == NULL) ||
      (io->read == NULL) || (io->unlock == NULL) || (io->erase == NULL) ||
      (io->program == NULL) || (io->lock == NULL) ||
      ((size_t)byte_offset + length > FLASH_STORE_PAGE_HALFWORDS * 2U)) {
    return FLASH_STORE_INVALID_ARGUMENT;
  }

  for (index = 0U; index < FLASH_STORE_PAGE_HALFWORDS; ++index) {
    workspace->old_page[index] = io->read(io->context, index);
    workspace->new_page[index] = workspace->old_page[index];
  }
  for (byte_index = 0U; byte_index < length; ++byte_index) {
    uint16_t halfword_index = (uint16_t)((byte_offset + byte_index) / 2U);
    uint16_t value = workspace->new_page[halfword_index];
    if (((byte_offset + byte_index) & 1U) == 0U) value = (uint16_t)((value & 0xFF00U) | payload[byte_index]);
    else value = (uint16_t)((value & 0x00FFU) | ((uint16_t)payload[byte_index] << 8U));
    workspace->new_page[halfword_index] = value;
  }

  if (io->unlock(io->context) != 0) {
    io->lock(io->context);
    return FLASH_STORE_ERROR;
  }

  if ((io->erase(io->context) != 0) || (FlashStore_ProgramPage(io, workspace->new_page) == 0U)) {
    /* A failed write or readback is never accepted: restore the saved page before returning. */
    result = (FlashStore_Restore(io, workspace->old_page) != 0U) ? FLASH_STORE_ERROR : FLASH_STORE_RESTORE_FAILED;
  }
  io->lock(io->context);
  return result;
}

#ifdef STM32F103xB
#include "stm32f1xx_hal.h"

static const uint32_t flash_store_page_address = 0x0800FC00UL;

static uint16_t FlashStoreHal_Read(void *context, uint16_t index)
{
  (void)context;
  return *(const volatile uint16_t *)(flash_store_page_address + ((uint32_t)index * 2U));
}

static int FlashStoreHal_Unlock(void *context) { (void)context; return (HAL_FLASH_Unlock() == HAL_OK) ? 0 : -1; }

static int FlashStoreHal_Erase(void *context)
{
  FLASH_EraseInitTypeDef erase = {0};
  uint32_t page_error = 0U;
  (void)context;
  erase.TypeErase = FLASH_TYPEERASE_PAGES;
  erase.PageAddress = flash_store_page_address;
  erase.NbPages = 1U;
  return (HAL_FLASHEx_Erase(&erase, &page_error) == HAL_OK) ? 0 : -1;
}

static int FlashStoreHal_Program(void *context, uint16_t index, uint16_t value)
{
  (void)context;
  return (HAL_FLASH_Program(FLASH_TYPEPROGRAM_HALFWORD,
                            flash_store_page_address + ((uint32_t)index * 2U), value) == HAL_OK) ? 0 : -1;
}

static void FlashStoreHal_Lock(void *context) { (void)context; (void)HAL_FLASH_Lock(); }

FlashStoreStatus FlashStoreHal_Update(FlashStoreWorkspace *workspace, uint16_t byte_offset,
                                      const uint8_t *payload, size_t length)
{
  /* HAL calls provide bounded timeout/error status; FlashStore_Update performs Restore and Readback. */
  FlashStoreIo io = {FlashStoreHal_Read, FlashStoreHal_Unlock, FlashStoreHal_Erase,
                     FlashStoreHal_Program, FlashStoreHal_Lock, NULL};
  return FlashStore_Update(&io, workspace, byte_offset, payload, length);
}
#else
FlashStoreStatus FlashStoreHal_Update(FlashStoreWorkspace *workspace, uint16_t byte_offset,
                                      const uint8_t *payload, size_t length)
{
  (void)workspace; (void)byte_offset; (void)payload; (void)length;
  return FLASH_STORE_ERROR;
}
#endif
