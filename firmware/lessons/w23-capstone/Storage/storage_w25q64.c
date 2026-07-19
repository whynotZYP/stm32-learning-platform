#include "storage_w25q64.h"

#include <string.h>
#include "main.h"
#include "spi.h"
#include "storage.h"

#define W25Q64_CMD_READ_DATA 0x03U
#define W25Q64_CMD_WRITE_ENABLE 0x06U
#define W25Q64_CMD_READ_STATUS_1 0x05U
#define W25Q64_CMD_JEDEC_ID 0x9FU
#define W25Q64_CMD_PAGE_PROGRAM 0x02U
#define W25Q64_CMD_SECTOR_ERASE 0x20U
#define W25Q64_LOG_SLOT_SIZE 32U
#define W25Q64_LOG_BASE 0x00100000UL
#define W25Q64_LOG_LIMIT 0x00102000UL
#define W25Q64_LOG_SLOT_COUNT ((W25Q64_LOG_LIMIT - W25Q64_LOG_BASE) / W25Q64_LOG_SLOT_SIZE)
#define W25Q64_TIMEOUT_MS 1000U
#define W25Q64_STATUS_WEL 0x02U
#define W25Q64_JEDEC_ID 0xEF4017UL

static uint32_t next_slot;

static void select_chip(void) { HAL_GPIO_WritePin(W25Q64_CS_GPIO_Port, W25Q64_CS_Pin, GPIO_PIN_RESET); }
static void deselect_chip(void) { HAL_GPIO_WritePin(W25Q64_CS_GPIO_Port, W25Q64_CS_Pin, GPIO_PIN_SET); }

static int read_status(uint8_t *status)
{
  uint8_t command = W25Q64_CMD_READ_STATUS_1;
  select_chip();
  if ((HAL_SPI_Transmit(&hspi2, &command, 1U, 20U) != HAL_OK) ||
      (HAL_SPI_Receive(&hspi2, status, 1U, 20U) != HAL_OK)) {
    deselect_chip();
    return -1;
  }
  deselect_chip();
  return 0;
}

static int read_jedec_id(uint32_t *jedec_id)
{
  uint8_t command = W25Q64_CMD_JEDEC_ID;
  uint8_t identity[3];
  select_chip();
  if ((HAL_SPI_Transmit(&hspi2, &command, 1U, 20U) != HAL_OK) ||
      (HAL_SPI_Receive(&hspi2, identity, sizeof(identity), 20U) != HAL_OK)) {
    deselect_chip();
    return -1;
  }
  deselect_chip();
  *jedec_id = ((uint32_t)identity[0] << 16U) | ((uint32_t)identity[1] << 8U) | identity[2];
  return 0;
}

static int write_enable(void)
{
  uint8_t command = W25Q64_CMD_WRITE_ENABLE;
  uint8_t status = 0U;
  select_chip();
  HAL_StatusTypeDef hal_status = HAL_SPI_Transmit(&hspi2, &command, 1U, 20U);
  deselect_chip();
  if (hal_status != HAL_OK) return -1;
  if (read_status(&status) != 0) return -1;
  return ((status & W25Q64_STATUS_WEL) != 0U) ? 0 : -1;
}

static int wait_ready(void)
{
  uint32_t started = HAL_GetTick();
  do {
    uint8_t status = 0xffU;
    if (read_status(&status) != 0) return -1;
    if ((status & 1U) == 0U) return 0;
  } while ((HAL_GetTick() - started) < W25Q64_TIMEOUT_MS);
  return -1;
}

static int read_data(uint32_t address, uint8_t *data, uint16_t length)
{
  uint8_t command[4] = {W25Q64_CMD_READ_DATA, (uint8_t)(address >> 16U),
                        (uint8_t)(address >> 8U), (uint8_t)address};
  if ((address < W25Q64_LOG_BASE) || (address >= W25Q64_LOG_LIMIT) ||
      ((uint32_t)length > (W25Q64_LOG_LIMIT - address))) return -1;
  select_chip();
  if ((HAL_SPI_Transmit(&hspi2, command, sizeof(command), 20U) != HAL_OK) ||
      (HAL_SPI_Receive(&hspi2, data, length, 100U) != HAL_OK)) {
    deselect_chip();
    return -1;
  }
  deselect_chip();
  return 0;
}

static int page_program(uint32_t address, const uint8_t *data, uint16_t length)
{
  uint8_t command[4] = {W25Q64_CMD_PAGE_PROGRAM, (uint8_t)(address >> 16U),
                        (uint8_t)(address >> 8U), (uint8_t)address};
  if ((address < W25Q64_LOG_BASE) || (address >= W25Q64_LOG_LIMIT) ||
      ((uint32_t)length > (W25Q64_LOG_LIMIT - address)) ||
      (length == 0U) || (length > W25Q64_LOG_SLOT_SIZE) ||
      (((address & 0xffU) + length) > 256U) || (write_enable() != 0)) return -1;
  select_chip();
  if ((HAL_SPI_Transmit(&hspi2, command, sizeof(command), 20U) != HAL_OK) ||
      (HAL_SPI_Transmit(&hspi2, (uint8_t *)data, length, 100U) != HAL_OK)) {
    deselect_chip();
    return -1;
  }
  deselect_chip();
  return wait_ready();
}

int StorageW25Q64_Init(void)
{
  uint32_t slot;
  uint32_t jedec_id = 0U;
  uint8_t marker[4];
  if ((read_jedec_id(&jedec_id) != 0) || (jedec_id != W25Q64_JEDEC_ID)) return -1;
  for (slot = 0U; slot < W25Q64_LOG_SLOT_COUNT; ++slot) {
    if (read_data(W25Q64_LOG_BASE + slot * W25Q64_LOG_SLOT_SIZE, marker, sizeof(marker)) != 0) return -1;
    if ((marker[0] == 0xffU) && (marker[1] == 0xffU) && (marker[2] == 0xffU) && (marker[3] == 0xffU)) {
      next_slot = slot;
      return 0;
    }
  }
  return -1;
}

int StorageW25Q64_Append(void *context, const SensorSnapshot *snapshot, uint32_t timestamp_utc)
{
  uint8_t encoded[W25Q64_LOG_SLOT_SIZE];
  uint8_t readback[W25Q64_LOG_SLOT_SIZE];
  size_t length;
  uint32_t address;
  (void)context;
  if (next_slot >= W25Q64_LOG_SLOT_COUNT) return -1;
  memset(encoded, 0xff, sizeof(encoded));
  length = Storage_EncodeRecord(encoded, sizeof(encoded), timestamp_utc,
                                (const uint8_t *)snapshot, (uint16_t)sizeof(*snapshot));
  if (length == 0U) return -1;
  address = W25Q64_LOG_BASE + next_slot * W25Q64_LOG_SLOT_SIZE;
  if ((page_program(address, encoded, (uint16_t)length) != 0) ||
      (read_data(address, readback, (uint16_t)length) != 0) ||
      (memcmp(encoded, readback, length) != 0)) return -1;
  ++next_slot;
  return 0;
}

int StorageW25Q64_EraseSectorRequested(uint32_t address)
{
  uint8_t command[4] = {W25Q64_CMD_SECTOR_ERASE, (uint8_t)(address >> 16U),
                        (uint8_t)(address >> 8U), (uint8_t)address};
  if ((address < W25Q64_LOG_BASE) || (address >= W25Q64_LOG_LIMIT) ||
      ((address & 0xfffU) != 0U) || (write_enable() != 0)) return -1;
  select_chip();
  if (HAL_SPI_Transmit(&hspi2, command, sizeof(command), 20U) != HAL_OK) {
    deselect_chip();
    return -1;
  }
  deselect_chip();
  return wait_ready();
}
