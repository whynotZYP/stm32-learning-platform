#include "app.h"

#include "adc.h"

enum {
  ADC_DMA_FRAME_COUNT = 2U,
  MEMORY_DMA_WORDS = 4U
};

static DMA_HandleTypeDef hdma_memory;
static uint32_t memory_source[MEMORY_DMA_WORDS] = {0x12345678U, 0xABCDEF01U, 0x55AA55AAU, 0x0F0FF0F0U};
static uint32_t memory_destination[MEMORY_DMA_WORDS];
static uint16_t adc_dma_buffer[DMA_SNAPSHOT_CHANNELS * ADC_DMA_FRAME_COUNT];
static DmaSnapshotStore snapshot_store;
static bool memory_dma_passed;

static bool run_memory_dma(void)
{
  uint32_t index;
  hdma_memory.Instance = DMA1_Channel2;
  hdma_memory.Init.Direction = DMA_MEMORY_TO_MEMORY;
  hdma_memory.Init.PeriphInc = DMA_PINC_ENABLE;
  hdma_memory.Init.MemInc = DMA_MINC_ENABLE;
  hdma_memory.Init.PeriphDataAlignment = DMA_PDATAALIGN_WORD;
  hdma_memory.Init.MemDataAlignment = DMA_MDATAALIGN_WORD;
  hdma_memory.Init.Mode = DMA_NORMAL;
  hdma_memory.Init.Priority = DMA_PRIORITY_LOW;
  if (HAL_DMA_Init(&hdma_memory) != HAL_OK) return false;
  if (HAL_DMA_Start(&hdma_memory, (uint32_t)memory_source, (uint32_t)memory_destination, MEMORY_DMA_WORDS) != HAL_OK) return false;
  if (HAL_DMA_PollForTransfer(&hdma_memory, HAL_DMA_FULL_TRANSFER, 10U) != HAL_OK) return false;
  for (index = 0U; index < MEMORY_DMA_WORDS; ++index) {
    if (memory_destination[index] != memory_source[index]) return false;
  }
  return true;
}

void App_Init(void)
{
  DmaSnapshot_Init(&snapshot_store);
  memory_dma_passed = run_memory_dma();
  if (HAL_ADCEx_Calibration_Start(&hadc1) != HAL_OK) Error_Handler();
  if (HAL_ADC_Start_DMA(&hadc1, (uint32_t *)adc_dma_buffer, DMA_SNAPSHOT_CHANNELS * ADC_DMA_FRAME_COUNT) != HAL_OK) Error_Handler();
}

void App_Run(void)
{
}

void HAL_ADC_ConvHalfCpltCallback(ADC_HandleTypeDef *hadc)
{
  if (hadc->Instance == ADC1) DmaSnapshot_Publish(&snapshot_store, &adc_dma_buffer[0]);
}

void HAL_ADC_ConvCpltCallback(ADC_HandleTypeDef *hadc)
{
  if (hadc->Instance == ADC1) DmaSnapshot_Publish(&snapshot_store, &adc_dma_buffer[DMA_SNAPSHOT_CHANNELS]);
}

bool App_GetAdcSnapshot(DmaSnapshot *snapshot)
{
  return DmaSnapshot_Read(&snapshot_store, snapshot);
}

bool App_MemoryDmaPassed(void)
{
  return memory_dma_passed;
}
