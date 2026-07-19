#include "w25q64_logic.h"

#include <string.h>

const uint32_t W25Q64_TEST_SECTOR_ADDRESS = 0x007FF000U;

enum {
  W25Q64_COMMAND_READ_ID = 0x9FU,
  W25Q64_COMMAND_READ_STATUS = 0x05U,
  W25Q64_COMMAND_WRITE_ENABLE = 0x06U,
  W25Q64_COMMAND_READ = 0x03U,
  W25Q64_COMMAND_PAGE_PROGRAM = 0x02U,
  W25Q64_COMMAND_SECTOR_ERASE = 0x20U,
  W25Q64_STATUS_WIP = 0x01U,
  W25Q64_STATUS_WEL = 0x02U,
  W25Q64_PAGE_PROGRAM_TIMEOUT_MS = 10U,
  W25Q64_SECTOR_ERASE_TIMEOUT_MS = 500U
};

static W25Q64_Result transaction(W25Q64_Bus *bus, const uint8_t *tx, uint8_t *rx, uint32_t length)
{
  W25Q64_Result result = bus->begin(bus->context);
  if (result == W25Q64_RESULT_OK) {
    result = bus->transfer(bus->context, tx, rx, length);
    bus->end(bus->context);
  }
  return result;
}

static W25Q64_Result read_status(W25Q64_Bus *bus, uint8_t *status)
{
  const uint8_t tx[2] = {W25Q64_COMMAND_READ_STATUS, 0xFFU};
  uint8_t rx[2] = {0U, 0U};
  const W25Q64_Result result = transaction(bus, tx, rx, sizeof(tx));
  *status = rx[1];
  return result;
}

static W25Q64_Result write_enable_checked(W25Q64_Bus *bus)
{
  const uint8_t command = W25Q64_COMMAND_WRITE_ENABLE;
  uint8_t status = 0U;
  W25Q64_Result result = transaction(bus, &command, 0, 1U);
  if (result == W25Q64_RESULT_OK) result = read_status(bus, &status);
  if (result == W25Q64_RESULT_OK && (status & W25Q64_STATUS_WEL) == 0U) return W25Q64_RESULT_WEL;
  return result;
}

W25Q64_Result W25Q64_WaitReady(W25Q64_Bus *bus, uint32_t timeout_ms)
{
  const uint32_t started = bus->now_ms(bus->context);
  do {
    uint8_t status = 0U;
    const W25Q64_Result result = read_status(bus, &status);
    if (result != W25Q64_RESULT_OK) return result;
    if ((status & W25Q64_STATUS_WIP) == 0U) return W25Q64_RESULT_OK;
  } while ((uint32_t)(bus->now_ms(bus->context) - started) < timeout_ms);
  return W25Q64_RESULT_TIMEOUT;
}

uint8_t W25Q64_IsPageRangeValid(uint32_t address, uint32_t length)
{
  if (length == 0U || length > W25Q64_PAGE_SIZE) return 0U;
  if (address < W25Q64_TEST_SECTOR_ADDRESS) return 0U;
  if (address + length < address) return 0U;
  if (address + length > W25Q64_TEST_SECTOR_ADDRESS + W25Q64_SECTOR_SIZE) return 0U;
  return (address / W25Q64_PAGE_SIZE) == ((address + length - 1U) / W25Q64_PAGE_SIZE);
}

uint8_t W25Q64_IsExpectedJedecId(const uint8_t id[3])
{
  return id[0] == 0xEFU && id[1] == 0x40U && id[2] == 0x17U;
}

W25Q64_Result W25Q64_ReadJedecId(W25Q64_Bus *bus, uint8_t id[3])
{
  const uint8_t tx[4] = {W25Q64_COMMAND_READ_ID, 0xFFU, 0xFFU, 0xFFU};
  uint8_t rx[4] = {0U, 0U, 0U, 0U};
  const W25Q64_Result result = transaction(bus, tx, rx, sizeof(tx));
  id[0] = rx[1]; id[1] = rx[2]; id[2] = rx[3];
  return result;
}

static W25Q64_Result read_fixed(W25Q64_Bus *bus, uint32_t address, uint8_t *data, uint32_t length)
{
  if (address < W25Q64_TEST_SECTOR_ADDRESS || address + length < address ||
      address + length > W25Q64_TEST_SECTOR_ADDRESS + W25Q64_SECTOR_SIZE) return W25Q64_RESULT_BOUNDS;
  const uint8_t header[4] = {
    W25Q64_COMMAND_READ, (uint8_t)(address >> 16U), (uint8_t)(address >> 8U), (uint8_t)address
  };
  W25Q64_Result result = bus->begin(bus->context);
  if (result == W25Q64_RESULT_OK) result = bus->transfer(bus->context, header, 0, sizeof(header));
  if (result == W25Q64_RESULT_OK) result = bus->transfer(bus->context, 0, data, length);
  bus->end(bus->context);
  return result;
}

static W25Q64_Result erase_fixed_sector(W25Q64_Bus *bus, uint8_t *command_started)
{
  *command_started = 0U;
  W25Q64_Result result = write_enable_checked(bus);
  if (result != W25Q64_RESULT_OK) return result;
  const uint8_t command[4] = {
    W25Q64_COMMAND_SECTOR_ERASE,
    (uint8_t)(W25Q64_TEST_SECTOR_ADDRESS >> 16U),
    (uint8_t)(W25Q64_TEST_SECTOR_ADDRESS >> 8U),
    (uint8_t)W25Q64_TEST_SECTOR_ADDRESS
  };
  result = bus->begin(bus->context);
  if (result == W25Q64_RESULT_OK) {
    *command_started = 1U;
    result = bus->transfer(bus->context, command, 0, sizeof(command));
    bus->end(bus->context);
  }
  return result == W25Q64_RESULT_OK ? W25Q64_WaitReady(bus, W25Q64_SECTOR_ERASE_TIMEOUT_MS) : result;
}

static W25Q64_Result program_page(W25Q64_Bus *bus, uint32_t address, const uint8_t *data, uint32_t length)
{
  if (!W25Q64_IsPageRangeValid(address, length)) return W25Q64_RESULT_BOUNDS;
  W25Q64_Result result = write_enable_checked(bus);
  if (result != W25Q64_RESULT_OK) return result;
  const uint8_t header[4] = {
    W25Q64_COMMAND_PAGE_PROGRAM, (uint8_t)(address >> 16U), (uint8_t)(address >> 8U), (uint8_t)address
  };
  result = bus->begin(bus->context);
  if (result == W25Q64_RESULT_OK) result = bus->transfer(bus->context, header, 0, sizeof(header));
  if (result == W25Q64_RESULT_OK) result = bus->transfer(bus->context, data, 0, length);
  bus->end(bus->context);
  return result == W25Q64_RESULT_OK ? W25Q64_WaitReady(bus, W25Q64_PAGE_PROGRAM_TIMEOUT_MS) : result;
}

static W25Q64_Result restore_and_verify(W25Q64_Bus *bus, const uint8_t backup[W25Q64_SECTOR_SIZE])
{
  uint8_t readback[W25Q64_PAGE_SIZE];
  uint8_t restore_erase_started = 0U;
  if (erase_fixed_sector(bus, &restore_erase_started) != W25Q64_RESULT_OK) return W25Q64_RESULT_RESTORE_FAILED;
  for (uint32_t offset = 0U; offset < W25Q64_SECTOR_SIZE; offset += W25Q64_PAGE_SIZE) {
    if (program_page(bus, W25Q64_TEST_SECTOR_ADDRESS + offset, &backup[offset], W25Q64_PAGE_SIZE) != W25Q64_RESULT_OK) {
      return W25Q64_RESULT_RESTORE_FAILED;
    }
  }
  for (uint32_t offset = 0U; offset < W25Q64_SECTOR_SIZE; offset += W25Q64_PAGE_SIZE) {
    if (read_fixed(bus, W25Q64_TEST_SECTOR_ADDRESS + offset, readback, sizeof(readback)) != W25Q64_RESULT_OK ||
        memcmp(readback, &backup[offset], sizeof(readback)) != 0) return W25Q64_RESULT_RESTORE_FAILED;
  }
  return W25Q64_RESULT_OK;
}

W25Q64_Result W25Q64_RunFixedSectorTest(W25Q64_Bus *bus, uint8_t backup[W25Q64_SECTOR_SIZE])
{
  uint8_t id[3];
  uint8_t test_page[W25Q64_PAGE_SIZE];
  uint8_t readback[W25Q64_PAGE_SIZE];
  uint8_t destructive_command_started = 0U;
  W25Q64_Result result = W25Q64_ReadJedecId(bus, id);
  if (result != W25Q64_RESULT_OK) return result;
  if (!W25Q64_IsExpectedJedecId(id)) return W25Q64_RESULT_ID;
  result = read_fixed(bus, W25Q64_TEST_SECTOR_ADDRESS, backup, W25Q64_SECTOR_SIZE);
  if (result != W25Q64_RESULT_OK) return result;
  for (uint32_t index = 0U; index < W25Q64_PAGE_SIZE; ++index) test_page[index] = (uint8_t)(0xA5U ^ index);

  result = erase_fixed_sector(bus, &destructive_command_started);
  if (!destructive_command_started) return result;
  if (result == W25Q64_RESULT_OK) result = program_page(bus, W25Q64_TEST_SECTOR_ADDRESS, test_page, sizeof(test_page));
  if (result == W25Q64_RESULT_OK) result = read_fixed(bus, W25Q64_TEST_SECTOR_ADDRESS, readback, sizeof(readback));
  if (result == W25Q64_RESULT_OK && memcmp(readback, test_page, sizeof(readback)) != 0) result = W25Q64_RESULT_VERIFY;

  const W25Q64_Result restore = restore_and_verify(bus, backup);
  if (restore != W25Q64_RESULT_OK) return W25Q64_RESULT_RESTORE_FAILED;
  return result;
}
