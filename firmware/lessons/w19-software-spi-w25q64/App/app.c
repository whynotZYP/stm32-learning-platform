#include "app.h"

#include "main.h"
#include "soft_spi.h"

static AppFlashState state;
static uint8_t sector_backup[W25Q64_SECTOR_SIZE];

static void set_cs(void *context, uint8_t level)
{
  (void)context;
  HAL_GPIO_WritePin(FLASH_CS_GPIO_Port, FLASH_CS_Pin, level ? GPIO_PIN_SET : GPIO_PIN_RESET);
}

static void set_sck(void *context, uint8_t level)
{
  (void)context;
  HAL_GPIO_WritePin(FLASH_SCK_GPIO_Port, FLASH_SCK_Pin, level ? GPIO_PIN_SET : GPIO_PIN_RESET);
}

static void set_mosi(void *context, uint8_t level)
{
  (void)context;
  HAL_GPIO_WritePin(FLASH_MOSI_GPIO_Port, FLASH_MOSI_Pin, level ? GPIO_PIN_SET : GPIO_PIN_RESET);
}

static uint8_t read_miso(void *context)
{
  (void)context;
  return HAL_GPIO_ReadPin(FLASH_MISO_GPIO_Port, FLASH_MISO_Pin) == GPIO_PIN_SET;
}

static SoftSpiIo soft_spi = {NULL, set_cs, set_sck, set_mosi, read_miso};

static W25Q64_Result flash_begin(void *context)
{
  SoftSpi_Select((SoftSpiIo *)context);
  return W25Q64_RESULT_OK;
}

static W25Q64_Result flash_transfer(void *context, const uint8_t *tx, uint8_t *rx, uint32_t length)
{
  SoftSpiIo *io = context;
  for (uint32_t index = 0U; index < length; ++index) {
    const uint8_t incoming = SoftSpi_TransferByte(io, tx ? tx[index] : 0xFFU);
    if (rx) rx[index] = incoming;
  }
  return W25Q64_RESULT_OK;
}

static void flash_end(void *context)
{
  SoftSpi_Deselect((SoftSpiIo *)context);
}

static uint32_t flash_now_ms(void *context)
{
  (void)context;
  return HAL_GetTick();
}

static W25Q64_Bus flash_bus = {&soft_spi, flash_begin, flash_transfer, flash_end, flash_now_ms};

void App_Init(void)
{
  SoftSpi_Init(&soft_spi);
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
