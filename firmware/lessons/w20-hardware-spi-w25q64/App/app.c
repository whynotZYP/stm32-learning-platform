#include "app.h"

#include "main.h"
#include "spi.h"

enum {
  HAL_SPI_TIMEOUT_MS = 20U,
  HAL_SPI_CHUNK_SIZE = 32U
};

static AppFlashState state;
static uint8_t sector_backup[W25Q64_SECTOR_SIZE];

static W25Q64_Result flash_begin(void *context)
{
  (void)context;
  HAL_GPIO_WritePin(FLASH_CS_GPIO_Port, FLASH_CS_Pin, GPIO_PIN_RESET);
  return W25Q64_RESULT_OK;
}

static W25Q64_Result flash_transfer(void *context, const uint8_t *tx, uint8_t *rx, uint32_t length)
{
  (void)context;
  uint8_t dummy_tx[HAL_SPI_CHUNK_SIZE];
  uint8_t dummy_rx[HAL_SPI_CHUNK_SIZE];
  for (uint8_t index = 0U; index < HAL_SPI_CHUNK_SIZE; ++index) dummy_tx[index] = 0xFFU;
  while (length > 0U) {
    const uint16_t chunk = (uint16_t)(length > HAL_SPI_CHUNK_SIZE ? HAL_SPI_CHUNK_SIZE : length);
    uint8_t *tx_buffer = tx ? (uint8_t *)tx : dummy_tx;
    uint8_t *rx_buffer = rx ? rx : dummy_rx;
    if (HAL_SPI_TransmitReceive(&hspi2, tx_buffer, rx_buffer, chunk, HAL_SPI_TIMEOUT_MS) != HAL_OK) {
      return W25Q64_RESULT_IO;
    }
    if (tx) tx += chunk;
    if (rx) rx += chunk;
    length -= chunk;
  }
  return W25Q64_RESULT_OK;
}

static void flash_end(void *context)
{
  (void)context;
  HAL_GPIO_WritePin(FLASH_CS_GPIO_Port, FLASH_CS_Pin, GPIO_PIN_SET);
}

static uint32_t flash_now_ms(void *context)
{
  (void)context;
  return HAL_GetTick();
}

static W25Q64_Bus flash_bus = {NULL, flash_begin, flash_transfer, flash_end, flash_now_ms};

void App_Init(void)
{
  HAL_GPIO_WritePin(FLASH_CS_GPIO_Port, FLASH_CS_Pin, GPIO_PIN_SET);
  state.result = W25Q64_ReadJedecId(&flash_bus, state.jedec_id);
  if (state.result == W25Q64_RESULT_OK && !W25Q64_IsExpectedJedecId(state.jedec_id)) {
    state.result = W25Q64_RESULT_ID;
  }
}

void App_Run(void)
{
  if (!state.test_requested || state.test_completed) return;
  const uint32_t started = HAL_GetTick();
  state.result = W25Q64_RunFixedSectorTest(&flash_bus, sector_backup);
  state.elapsed_ms = HAL_GetTick() - started;
  state.test_completed = 1U;
}

void App_RequestFixedSectorTest(void)
{
  state.test_requested = 1U;
}

AppFlashState App_GetFlashState(void)
{
  return state;
}
