#include "device_tests_stm32.h"

#include <stdio.h>
#include <string.h>

#include "adc.h"
#include "i2c.h"
#include "main.h"
#include "rtc.h"
#include "spi.h"

#define UID_BASE_ADDRESS 0x1FFFF7E8UL
#define INTERNAL_TEST_PAGE 0x0800FC00UL
#define INTERNAL_PAGE_SIZE 1024U
#define W25_TEST_SECTOR 0x007FF000UL
#define W25_SECTOR_SIZE 4096U

static uint32_t boot_reset_flags;
static volatile uint32_t exti_events;
static uint8_t internal_backup[INTERNAL_PAGE_SIZE];
static uint8_t external_backup[W25_SECTOR_SIZE];

static DeviceTestOutcome outcome(DeviceTestStatus status, const char *message)
{
  DeviceTestOutcome result = {status, "{}", message};
  return result;
}

static DeviceTestOutcome hello(void)
{
  DeviceTestOutcome result = outcome(DEVICE_TEST_PASS, "ok");
  snprintf(result.details, sizeof(result.details),
           "{\"firmware\":\"device-test-v1\",\"protocol\":1,\"build\":\"%s\"}",
           __DATE__);
  return result;
}

static DeviceTestOutcome chip_id(void)
{
  const volatile uint32_t *uid = (const volatile uint32_t *)UID_BASE_ADDRESS;
  DeviceTestOutcome result = outcome(DEVICE_TEST_PASS, "ok");
  snprintf(result.details, sizeof(result.details),
           "{\"uid0\":\"%08lX\",\"uid1\":\"%08lX\",\"uid2\":\"%08lX\"}",
           (unsigned long)uid[0], (unsigned long)uid[1],
           (unsigned long)uid[2]);
  return result;
}

static DeviceTestOutcome gpio_loopback(void)
{
  GPIO_InitTypeDef gpio = {0};
  GPIO_PinState low;
  GPIO_PinState high;
  DeviceTestOutcome result;
  __HAL_RCC_GPIOB_CLK_ENABLE();
  gpio.Pin = GPIO_PIN_0;
  gpio.Mode = GPIO_MODE_OUTPUT_PP;
  gpio.Speed = GPIO_SPEED_FREQ_LOW;
  HAL_GPIO_Init(GPIOB, &gpio);
  gpio.Pin = GPIO_PIN_1;
  gpio.Mode = GPIO_MODE_INPUT;
  gpio.Pull = GPIO_PULLDOWN;
  HAL_GPIO_Init(GPIOB, &gpio);
  HAL_GPIO_WritePin(GPIOB, GPIO_PIN_0, GPIO_PIN_RESET);
  HAL_Delay(2U);
  low = HAL_GPIO_ReadPin(GPIOB, GPIO_PIN_1);
  HAL_GPIO_WritePin(GPIOB, GPIO_PIN_0, GPIO_PIN_SET);
  HAL_Delay(2U);
  high = HAL_GPIO_ReadPin(GPIOB, GPIO_PIN_1);
  HAL_GPIO_DeInit(GPIOB, GPIO_PIN_0 | GPIO_PIN_1);
  result = outcome(low == GPIO_PIN_RESET && high == GPIO_PIN_SET
                       ? DEVICE_TEST_PASS : DEVICE_TEST_PRECONDITION,
                   "connect PB0 to PB1");
  snprintf(result.details, sizeof(result.details),
           "{\"out\":\"PB0\",\"in\":\"PB1\",\"low\":%lu,\"high\":%lu}",
           (unsigned long)low, (unsigned long)high);
  return result;
}

static DeviceTestOutcome exti_event_count(void)
{
  GPIO_InitTypeDef gpio = {0};
  uint32_t started;
  uint32_t count;
  DeviceTestOutcome result;
  __HAL_RCC_GPIOB_CLK_ENABLE();
  gpio.Pin = GPIO_PIN_1;
  gpio.Mode = GPIO_MODE_IT_FALLING;
  gpio.Pull = GPIO_PULLUP;
  HAL_GPIO_Init(GPIOB, &gpio);
  exti_events = 0U;
  __HAL_GPIO_EXTI_CLEAR_IT(GPIO_PIN_1);
  HAL_NVIC_SetPriority(EXTI1_IRQn, 2U, 0U);
  HAL_NVIC_EnableIRQ(EXTI1_IRQn);
  started = HAL_GetTick();
  while ((HAL_GetTick() - started) < 10000U) {
    HAL_Delay(2U);
  }
  HAL_NVIC_DisableIRQ(EXTI1_IRQn);
  count = exti_events;
  HAL_GPIO_DeInit(GPIOB, GPIO_PIN_1);
  result = outcome(count > 0U ? DEVICE_TEST_PASS : DEVICE_TEST_PRECONDITION,
                   "toggle PB1 during the 10 second window");
  snprintf(result.details, sizeof(result.details),
           "{\"pin\":\"PB1\",\"events\":%lu,\"window_ms\":10000}",
           (unsigned long)count);
  return result;
}

void EXTI1_IRQHandler(void)
{
  HAL_GPIO_EXTI_IRQHandler(GPIO_PIN_1);
}

void HAL_GPIO_EXTI_Callback(uint16_t gpio_pin)
{
  if (gpio_pin == GPIO_PIN_1) ++exti_events;
}

static int wait_timer_flag(TIM_TypeDef *timer, uint32_t flag,
                           uint32_t timeout_ms)
{
  uint32_t started = HAL_GetTick();
  while ((timer->SR & flag) == 0U) {
    if ((HAL_GetTick() - started) >= timeout_ms) return 0;
  }
  timer->SR = ~flag;
  return 1;
}

static DeviceTestOutcome tim_pwm_capture(void)
{
  GPIO_InitTypeDef gpio = {0};
  uint32_t period = 0U;
  uint32_t high = 0U;
  DeviceTestOutcome result;
  __HAL_RCC_GPIOA_CLK_ENABLE();
  __HAL_RCC_TIM2_CLK_ENABLE();
  __HAL_RCC_TIM3_CLK_ENABLE();
  gpio.Pin = GPIO_PIN_0;
  gpio.Mode = GPIO_MODE_AF_PP;
  gpio.Speed = GPIO_SPEED_FREQ_HIGH;
  HAL_GPIO_Init(GPIOA, &gpio);
  gpio.Pin = GPIO_PIN_6;
  gpio.Mode = GPIO_MODE_INPUT;
  gpio.Pull = GPIO_NOPULL;
  HAL_GPIO_Init(GPIOA, &gpio);
  TIM2->PSC = 71U;
  TIM2->ARR = 999U;
  TIM2->CCR1 = 500U;
  TIM2->CCMR1 = TIM_CCMR1_OC1M_1 | TIM_CCMR1_OC1M_2 | TIM_CCMR1_OC1PE;
  TIM2->CCER = TIM_CCER_CC1E;
  TIM2->EGR = TIM_EGR_UG;
  TIM2->CR1 = TIM_CR1_ARPE | TIM_CR1_CEN;
  TIM3->PSC = 71U;
  TIM3->ARR = 0xFFFFU;
  TIM3->CCMR1 = TIM_CCMR1_CC1S_0 | TIM_CCMR1_CC2S_1;
  TIM3->CCER = TIM_CCER_CC1E | TIM_CCER_CC2E | TIM_CCER_CC2P;
  TIM3->SMCR = TIM_SMCR_TS_2 | TIM_SMCR_TS_0 | TIM_SMCR_SMS_2;
  TIM3->EGR = TIM_EGR_UG;
  TIM3->SR = 0U;
  TIM3->CR1 = TIM_CR1_CEN;
  if (!wait_timer_flag(TIM3, TIM_SR_CC1IF, 100U) ||
      !wait_timer_flag(TIM3, TIM_SR_CC1IF, 100U)) {
    result = outcome(DEVICE_TEST_PRECONDITION, "connect PA0 to PA6");
  } else {
    period = TIM3->CCR1;
    high = TIM3->CCR2;
    result = outcome(period >= 980U && period <= 1020U && high >= 490U &&
                             high <= 510U
                         ? DEVICE_TEST_PASS : DEVICE_TEST_FAIL,
                     "captured PWM is outside tolerance");
  }
  TIM2->CR1 = 0U;
  TIM3->CR1 = 0U;
  __HAL_RCC_TIM2_CLK_DISABLE();
  __HAL_RCC_TIM3_CLK_DISABLE();
  HAL_GPIO_DeInit(GPIOA, GPIO_PIN_0 | GPIO_PIN_6);
  MX_ADC1_Init();
  snprintf(result.details, sizeof(result.details),
           "{\"out\":\"PA0\",\"in\":\"PA6\",\"period_us\":%lu,\"high_us\":%lu}",
           (unsigned long)period, (unsigned long)high);
  return result;
}

static DeviceTestOutcome adc_range_dma(void)
{
  static volatile uint16_t samples[32];
  uint32_t started;
  uint16_t minimum = 0xFFFFU;
  uint16_t maximum = 0U;
  size_t index;
  DeviceTestOutcome result;
  __HAL_RCC_DMA1_CLK_ENABLE();
  DMA1_Channel1->CCR = 0U;
  DMA1->IFCR = DMA_IFCR_CGIF1;
  DMA1_Channel1->CPAR = (uint32_t)&ADC1->DR;
  DMA1_Channel1->CMAR = (uint32_t)samples;
  DMA1_Channel1->CNDTR = 32U;
  DMA1_Channel1->CCR = DMA_CCR_MINC | DMA_CCR_PSIZE_0 | DMA_CCR_MSIZE_0 |
                       DMA_CCR_PL_0;
  ADC1->CR1 &= ~ADC_CR1_DISCEN;
  ADC1->CR2 |= ADC_CR2_DMA | ADC_CR2_CONT | ADC_CR2_EXTTRIG;
  DMA1_Channel1->CCR |= DMA_CCR_EN;
  ADC1->CR2 |= ADC_CR2_ADON;
  HAL_Delay(1U);
  ADC1->CR2 |= ADC_CR2_SWSTART;
  started = HAL_GetTick();
  while (DMA1_Channel1->CNDTR != 0U && (HAL_GetTick() - started) < 100U) {}
  ADC1->CR2 &= ~(ADC_CR2_CONT | ADC_CR2_DMA | ADC_CR2_ADON);
  DMA1_Channel1->CCR = 0U;
  if (DMA1_Channel1->CNDTR != 0U) {
    return outcome(DEVICE_TEST_TIMEOUT, "ADC DMA did not complete");
  }
  for (index = 0U; index < 32U; ++index) {
    if (samples[index] < minimum) minimum = samples[index];
    if (samples[index] > maximum) maximum = samples[index];
  }
  result = outcome(maximum <= 4095U ? DEVICE_TEST_PASS : DEVICE_TEST_FAIL,
                   "ADC sample outside 12-bit range");
  snprintf(result.details, sizeof(result.details),
           "{\"pin0\":\"PA0\",\"pin1\":\"PA1\",\"samples\":32,\"min\":%u,\"max\":%u}",
           minimum, maximum);
  return result;
}

static DeviceTestOutcome dma_memory_copy(void)
{
  static const uint32_t source[8] = {
    0x10203040U, 0x50607080U, 0x90A0B0C0U, 0xD0E0F000U,
    1U, 2U, 3U, 4U
  };
  static uint32_t destination[8];
  uint32_t started;
  DeviceTestOutcome result;
  memset(destination, 0, sizeof(destination));
  __HAL_RCC_DMA1_CLK_ENABLE();
  DMA1_Channel2->CCR = 0U;
  DMA1->IFCR = DMA_IFCR_CGIF2;
  DMA1_Channel2->CPAR = (uint32_t)source;
  DMA1_Channel2->CMAR = (uint32_t)destination;
  DMA1_Channel2->CNDTR = 8U;
  DMA1_Channel2->CCR = DMA_CCR_MEM2MEM | DMA_CCR_PINC |
                       DMA_CCR_MINC | DMA_CCR_PSIZE_1 | DMA_CCR_MSIZE_1 |
                       DMA_CCR_PL_1 | DMA_CCR_EN;
  started = HAL_GetTick();
  while ((DMA1->ISR & DMA_ISR_TCIF2) == 0U &&
         (HAL_GetTick() - started) < 100U) {}
  DMA1_Channel2->CCR = 0U;
  result = outcome(memcmp(source, destination, sizeof(source)) == 0
                       ? DEVICE_TEST_PASS : DEVICE_TEST_FAIL,
                   "DMA memory comparison failed");
  snprintf(result.details, sizeof(result.details),
           "{\"words\":8,\"bytes\":32,\"match\":%s}",
           result.status == DEVICE_TEST_PASS ? "true" : "false");
  return result;
}

static DeviceTestOutcome usart_packet(void)
{
  DeviceTestOutcome result = outcome(DEVICE_TEST_PASS, "ok");
  snprintf(result.details, sizeof(result.details),
           "{\"port\":\"USART1\",\"baud\":115200,\"protocol\":1,\"frame_valid\":true}");
  return result;
}

static DeviceTestOutcome mpu6050_id(void)
{
  uint8_t who_am_i = 0U;
  DeviceTestOutcome result;
  HAL_StatusTypeDef status = HAL_I2C_Mem_Read(&hi2c1, 0x68U << 1U, 0x75U,
                                              I2C_MEMADD_SIZE_8BIT,
                                              &who_am_i, 1U, 100U);
  result = outcome(status != HAL_OK ? DEVICE_TEST_PRECONDITION
                                   : (who_am_i == 0x68U || who_am_i == 0x69U
                                          ? DEVICE_TEST_PASS : DEVICE_TEST_FAIL),
                   status != HAL_OK ? "connect MPU6050 to PB6 and PB7"
                                    : "unexpected WHO_AM_I");
  snprintf(result.details, sizeof(result.details),
           "{\"address\":\"0x68\",\"who_am_i\":\"0x%02X\",\"hal_status\":%u}",
           who_am_i, (unsigned int)status);
  return result;
}

static void w25_select(int selected)
{
  HAL_GPIO_WritePin(W25Q64_CS_GPIO_Port, W25Q64_CS_Pin,
                    selected ? GPIO_PIN_RESET : GPIO_PIN_SET);
}

static int w25_command(const uint8_t *tx, uint8_t *rx, uint16_t size)
{
  HAL_StatusTypeDef status;
  w25_select(1);
  status = rx == NULL ? HAL_SPI_Transmit(&hspi2, (uint8_t *)tx, size, 100U)
                      : HAL_SPI_TransmitReceive(&hspi2, (uint8_t *)tx, rx,
                                                size, 100U);
  w25_select(0);
  return status == HAL_OK;
}

static int w25_wait_ready(uint32_t timeout_ms)
{
  uint8_t tx[2] = {0x05U, 0xFFU};
  uint8_t rx[2];
  uint32_t started = HAL_GetTick();
  do {
    if (!w25_command(tx, rx, 2U)) return 0;
    if ((rx[1] & 1U) == 0U) return 1;
  } while ((HAL_GetTick() - started) < timeout_ms);
  return 0;
}

static int w25_write_enable(void)
{
  uint8_t command = 0x06U;
  return w25_command(&command, NULL, 1U);
}

static int w25_read(uint32_t address, uint8_t *data, uint16_t size)
{
  uint8_t header[4] = {0x03U, (uint8_t)(address >> 16U),
                       (uint8_t)(address >> 8U), (uint8_t)address};
  HAL_StatusTypeDef status;
  w25_select(1);
  status = HAL_SPI_Transmit(&hspi2, header, 4U, 100U);
  if (status == HAL_OK) status = HAL_SPI_Receive(&hspi2, data, size, 500U);
  w25_select(0);
  return status == HAL_OK;
}

static int w25_erase_sector(uint32_t address)
{
  uint8_t command[4] = {0x20U, (uint8_t)(address >> 16U),
                        (uint8_t)(address >> 8U), (uint8_t)address};
  return w25_write_enable() && w25_command(command, NULL, 4U) &&
         w25_wait_ready(5000U);
}

static int w25_program(uint32_t address, const uint8_t *data, uint16_t size)
{
  uint8_t header[4] = {0x02U, (uint8_t)(address >> 16U),
                       (uint8_t)(address >> 8U), (uint8_t)address};
  HAL_StatusTypeDef status;
  if (!w25_write_enable()) return 0;
  w25_select(1);
  status = HAL_SPI_Transmit(&hspi2, header, 4U, 100U);
  if (status == HAL_OK) status = HAL_SPI_Transmit(&hspi2, (uint8_t *)data,
                                                  size, 500U);
  w25_select(0);
  return status == HAL_OK && w25_wait_ready(1000U);
}

static int w25_restore_sector(const uint8_t *data)
{
  uint32_t offset;
  if (!w25_erase_sector(W25_TEST_SECTOR)) return 0;
  for (offset = 0U; offset < W25_SECTOR_SIZE; offset += 256U) {
    if (!w25_program(W25_TEST_SECTOR + offset, data + offset, 256U)) return 0;
  }
  return 1;
}

static int w25_read_jedec(uint8_t id[3])
{
  uint8_t tx[4] = {0x9FU, 0xFFU, 0xFFU, 0xFFU};
  uint8_t rx[4] = {0U};
  if (!w25_command(tx, rx, 4U)) return 0;
  id[0] = rx[1];
  id[1] = rx[2];
  id[2] = rx[3];
  return 1;
}

static int w25_is_expected_device(const uint8_t id[3])
{
  return id[0] == 0xEFU && id[1] == 0x40U && id[2] == 0x17U;
}

static int w25_verify_sector(const uint8_t *expected)
{
  static uint8_t verify[256];
  uint32_t offset;
  for (offset = 0U; offset < W25_SECTOR_SIZE; offset += sizeof(verify)) {
    if (!w25_read(W25_TEST_SECTOR + offset, verify, sizeof(verify)) ||
        memcmp(expected + offset, verify, sizeof(verify)) != 0) return 0;
  }
  return 1;
}

static DeviceTestOutcome spi_flash_id(void)
{
  uint8_t id[3] = {0U};
  DeviceTestOutcome result;
  int id_ok = w25_read_jedec(id) && w25_is_expected_device(id);
  result = outcome(id_ok ? DEVICE_TEST_PASS : DEVICE_TEST_PRECONDITION,
                   "expected W25Q64 EF4017 on SPI2 PB12 through PB15");
  snprintf(result.details, sizeof(result.details),
           "{\"manufacturer\":\"0x%02X\",\"memory_type\":\"0x%02X\",\"capacity\":\"0x%02X\"}",
           id[0], id[1], id[2]);
  return result;
}

static DeviceTestOutcome spi_flash_roundtrip(void)
{
  static const uint8_t pattern[16] = {
    0x53U, 0x54U, 0x4DU, 0x33U, 0x32U, 0x2DU, 0x54U, 0x45U,
    0x53U, 0x54U, 0x2DU, 0x56U, 0x31U, 0xA5U, 0x5AU, 0x00U
  };
  uint8_t verify[16];
  uint8_t id[3] = {0U};
  DeviceTestOutcome result;
  int tested;
  int restored;
  if (!w25_read_jedec(id) || !w25_is_expected_device(id)) {
    return outcome(DEVICE_TEST_PRECONDITION,
                   "roundtrip requires W25Q64 JEDEC ID EF4017");
  }
  if (!w25_read(W25_TEST_SECTOR, external_backup, W25_SECTOR_SIZE)) {
    return outcome(DEVICE_TEST_HARDWARE, "W25Q64 backup read failed");
  }
  tested = w25_erase_sector(W25_TEST_SECTOR) &&
           w25_program(W25_TEST_SECTOR, pattern, sizeof(pattern)) &&
           w25_read(W25_TEST_SECTOR, verify, sizeof(verify)) &&
           memcmp(pattern, verify, sizeof(pattern)) == 0;
  restored = w25_restore_sector(external_backup) &&
             w25_verify_sector(external_backup);
  result = outcome(tested && restored ? DEVICE_TEST_PASS : DEVICE_TEST_HARDWARE,
                   restored ? "flash roundtrip failed" : "flash restore failed");
  snprintf(result.details, sizeof(result.details),
           "{\"sector\":\"0x7FF000\",\"bytes\":4096,\"test_match\":%s,\"restored\":%s}",
           tested ? "true" : "false", restored ? "true" : "false");
  return result;
}

static uint32_t rtc_counter(void)
{
  uint32_t high;
  uint32_t low;
  uint32_t verify_high;
  do {
    high = RTC->CNTH;
    low = RTC->CNTL;
    verify_high = RTC->CNTH;
  } while (high != verify_high);
  return (high << 16U) | low;
}

static DeviceTestOutcome rtc_backup(void)
{
  const uint32_t marker = 0xA55AU;
  uint32_t previous;
  uint32_t value;
  uint32_t counter;
  DeviceTestOutcome result;
  HAL_PWR_EnableBkUpAccess();
  previous = HAL_RTCEx_BKUPRead(&hrtc, RTC_BKP_DR1);
  HAL_RTCEx_BKUPWrite(&hrtc, RTC_BKP_DR1, marker);
  value = HAL_RTCEx_BKUPRead(&hrtc, RTC_BKP_DR1);
  counter = rtc_counter();
  HAL_Delay(1100U);
  counter = rtc_counter() - counter;
  HAL_RTCEx_BKUPWrite(&hrtc, RTC_BKP_DR1, previous);
  result = outcome(value == marker && counter >= 1U ? DEVICE_TEST_PASS
                                                     : DEVICE_TEST_FAIL,
                   "RTC counter or backup register failed");
  snprintf(result.details, sizeof(result.details),
           "{\"backup_match\":%s,\"counter_delta\":%lu}",
           value == marker ? "true" : "false", (unsigned long)counter);
  return result;
}

static DeviceTestOutcome watchdog_reset_cause(void)
{
  DeviceTestOutcome result = outcome(
      (boot_reset_flags & RCC_CSR_IWDGRSTF) != 0U ? DEVICE_TEST_PASS
                                                  : DEVICE_TEST_PRECONDITION,
      "no watchdog reset flag; run the lesson watchdog-reset step first");
  snprintf(result.details, sizeof(result.details),
           "{\"iwdg_reset\":%s,\"reset_flags\":\"0x%08lX\"}",
           (boot_reset_flags & RCC_CSR_IWDGRSTF) != 0U ? "true" : "false",
           (unsigned long)boot_reset_flags);
  __HAL_RCC_CLEAR_RESET_FLAGS();
  return result;
}

static int internal_flash_write_page(const uint8_t *data)
{
  FLASH_EraseInitTypeDef erase = {0};
  uint32_t page_error = 0U;
  uint32_t offset;
  int ok = 1;
  HAL_FLASH_Unlock();
  erase.TypeErase = FLASH_TYPEERASE_PAGES;
  erase.PageAddress = INTERNAL_TEST_PAGE;
  erase.NbPages = 1U;
  if (HAL_FLASHEx_Erase(&erase, &page_error) != HAL_OK) ok = 0;
  for (offset = 0U; ok && offset < INTERNAL_PAGE_SIZE; offset += 4U) {
    uint32_t word;
    memcpy(&word, data + offset, sizeof(word));
    if (HAL_FLASH_Program(FLASH_TYPEPROGRAM_WORD,
                          INTERNAL_TEST_PAGE + offset, word) != HAL_OK) ok = 0;
  }
  HAL_FLASH_Lock();
  return ok;
}

static DeviceTestOutcome internal_flash_roundtrip(void)
{
  static uint8_t pattern_page[INTERNAL_PAGE_SIZE];
  const uint8_t *flash = (const uint8_t *)INTERNAL_TEST_PAGE;
  DeviceTestOutcome result;
  int tested;
  int restored;
  size_t index;
  memcpy(internal_backup, flash, sizeof(internal_backup));
  for (index = 0U; index < sizeof(pattern_page); ++index) {
    pattern_page[index] = (uint8_t)(index ^ 0xA5U);
  }
  tested = internal_flash_write_page(pattern_page) &&
           memcmp(flash, pattern_page, sizeof(pattern_page)) == 0;
  restored = internal_flash_write_page(internal_backup) &&
             memcmp(flash, internal_backup, sizeof(internal_backup)) == 0;
  result = outcome(tested && restored ? DEVICE_TEST_PASS : DEVICE_TEST_HARDWARE,
                   restored ? "reserved page test failed" : "reserved page restore failed");
  snprintf(result.details, sizeof(result.details),
           "{\"page\":\"0x0800FC00\",\"bytes\":1024,\"test_match\":%s,\"restored\":%s}",
           tested ? "true" : "false", restored ? "true" : "false");
  return result;
}

static DeviceTestOutcome sleep_wake(void)
{
  uint32_t started;
  uint32_t elapsed_ms;
  DeviceTestOutcome result;
  SCB->ICSR = SCB_ICSR_PENDSTCLR_Msk;
  started = HAL_GetTick();
  HAL_PWR_EnterSLEEPMode(PWR_MAINREGULATOR_ON, PWR_SLEEPENTRY_WFI);
  elapsed_ms = HAL_GetTick() - started;
  result = outcome(elapsed_ms > 0U && elapsed_ms <= 10U ? DEVICE_TEST_PASS
                                                        : DEVICE_TEST_FAIL,
                   "sleep did not wake from the bounded SysTick interval");
  snprintf(result.details, sizeof(result.details),
           "{\"mode\":\"sleep\",\"wake\":\"SysTick\",\"elapsed_ms\":%lu}",
           (unsigned long)elapsed_ms);
  return result;
}

void DeviceTestsStm32_Init(void)
{
  boot_reset_flags = RCC->CSR;
  __HAL_RCC_DMA1_CLK_ENABLE();
}

DeviceTestOutcome DeviceTestsStm32_Run(const char *test_id)
{
  if (strcmp(test_id, "system.hello") == 0) return hello();
  if (strcmp(test_id, "system.chip-id") == 0) return chip_id();
  if (strcmp(test_id, "gpio.loopback") == 0) return gpio_loopback();
  if (strcmp(test_id, "exti.event-count") == 0) return exti_event_count();
  if (strcmp(test_id, "tim.pwm-capture") == 0) return tim_pwm_capture();
  if (strcmp(test_id, "adc.range-dma") == 0) return adc_range_dma();
  if (strcmp(test_id, "dma.memory-copy") == 0) return dma_memory_copy();
  if (strcmp(test_id, "usart.packet") == 0) return usart_packet();
  if (strcmp(test_id, "i2c.mpu6050-id") == 0) return mpu6050_id();
  if (strcmp(test_id, "spi.flash-id") == 0) return spi_flash_id();
  if (strcmp(test_id, "spi.flash-roundtrip") == 0) return spi_flash_roundtrip();
  if (strcmp(test_id, "rtc.bkp") == 0) return rtc_backup();
  if (strcmp(test_id, "wdg.reset-cause") == 0) return watchdog_reset_cause();
  if (strcmp(test_id, "flash.reserved-page") == 0) return internal_flash_roundtrip();
  if (strcmp(test_id, "pwr.sleep-wake") == 0) return sleep_wake();
  return outcome(DEVICE_TEST_HARDWARE, "unknown test");
}
