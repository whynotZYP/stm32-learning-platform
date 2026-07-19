#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "i2c_bitbang.h"
#include "mpu6050_logic.h"
#include "soft_spi.h"
#include "w25q64_logic.h"

#define CHECK(condition) do { \
  if (!(condition)) { \
    fprintf(stderr, "CHECK failed at line %d: %s\n", __LINE__, #condition); \
    return 1; \
  } \
} while (0)

typedef enum {
  I2C_EVENT_SDA_RELEASE = 1,
  I2C_EVENT_SCL_LOW,
  I2C_EVENT_SCL_RELEASE,
  I2C_EVENT_SDA_LOW
} FakeI2cEvent;

typedef struct {
  uint8_t scl;
  uint8_t master_sda_released;
  uint8_t hold_scl_low;
  uint32_t scl_low_count;
  uint32_t scl_release_count;
  uint32_t sda_low_count;
  uint32_t sda_release_count;
  uint32_t now_ticks;
  uint8_t slave_holds_sda_low;
  uint8_t release_slave_sda_after_nine;
  FakeI2cEvent events[64];
  uint8_t event_count;
} FakeI2c;

static void i2c_record(FakeI2c *fake, FakeI2cEvent event)
{
  if (fake->event_count < 64U) fake->events[fake->event_count++] = event;
}

static void i2c_scl_low(void *context)
{
  FakeI2c *fake = context;
  fake->scl = 0U;
  ++fake->scl_low_count;
  i2c_record(fake, I2C_EVENT_SCL_LOW);
}
static void i2c_scl_release(void *context)
{
  FakeI2c *fake = context;
  fake->scl = 1U;
  ++fake->scl_release_count;
  i2c_record(fake, I2C_EVENT_SCL_RELEASE);
  if (fake->release_slave_sda_after_nine && fake->scl_low_count >= 9U) fake->slave_holds_sda_low = 0U;
}
static void i2c_sda_low(void *context)
{
  FakeI2c *fake = context;
  fake->master_sda_released = 0U;
  ++fake->sda_low_count;
  i2c_record(fake, I2C_EVENT_SDA_LOW);
}
static void i2c_sda_release(void *context)
{
  FakeI2c *fake = context;
  fake->master_sda_released = 1U;
  ++fake->sda_release_count;
  i2c_record(fake, I2C_EVENT_SDA_RELEASE);
}
static uint8_t i2c_read_scl(void *context) { FakeI2c *fake = context; return fake->hold_scl_low ? 0U : fake->scl; }
static uint8_t i2c_read_sda(void *context) { FakeI2c *fake = context; return fake->master_sda_released && !fake->slave_holds_sda_low; }
static void i2c_step(void *context) { ((FakeI2c *)context)->now_ticks += 5U; }
static uint32_t i2c_now_ticks(void *context) { return ((FakeI2c *)context)->now_ticks; }

static I2cBitBangBus make_i2c_bus(FakeI2c *fake)
{
  I2cBitBangBus bus = {
    fake, i2c_scl_low, i2c_scl_release, i2c_sda_low, i2c_sda_release,
    i2c_read_scl, i2c_read_sda, i2c_step, i2c_now_ticks, 20U
  };
  return bus;
}

static int test_i2c_release_timeout_nack_and_recovery(void)
{
  FakeI2c held = {0};
  held.slave_holds_sda_low = 1U;
  i2c_sda_release(&held);
  CHECK(held.master_sda_released == 1U && i2c_read_sda(&held) == 0U);

  FakeI2c fake = {0};
  fake.scl = 1U;
  fake.slave_holds_sda_low = 1U;
  fake.release_slave_sda_after_nine = 1U;
  I2cBitBangBus bus = make_i2c_bus(&fake);
  CHECK(I2cBitBang_Recover(&bus) == I2C_RESULT_OK);
  CHECK(fake.scl_low_count == 9U);
  CHECK(fake.scl_release_count == 9U);
  CHECK(fake.sda_low_count == 1U);
  CHECK(fake.sda_release_count == 2U);
  CHECK(fake.event_count == 21U && fake.events[0] == I2C_EVENT_SDA_RELEASE);
  for (uint8_t pulse = 0U; pulse < 9U; ++pulse) {
    CHECK(fake.events[1U + pulse * 2U] == I2C_EVENT_SCL_LOW);
    CHECK(fake.events[2U + pulse * 2U] == I2C_EVENT_SCL_RELEASE);
  }
  CHECK(fake.events[19] == I2C_EVENT_SDA_LOW && fake.events[20] == I2C_EVENT_SDA_RELEASE);
  CHECK(fake.scl == 1U && fake.master_sda_released == 1U && fake.slave_holds_sda_low == 0U);

  fake = (FakeI2c){0};
  fake.scl = 1U; fake.master_sda_released = 1U;
  bus = make_i2c_bus(&fake);
  CHECK(I2cBitBang_WriteByte(&bus, 0xA0U) == I2C_RESULT_NACK);
  CHECK(fake.scl_low_count >= 8U);
  CHECK(fake.sda_release_count > 0U);

  fake = (FakeI2c){0};
  fake.master_sda_released = 1U; fake.hold_scl_low = 1U;
  bus = make_i2c_bus(&fake);
  CHECK(I2cBitBang_WriteByte(&bus, 0x00U) == I2C_RESULT_TIMEOUT);
  CHECK(fake.master_sda_released == 0U);
  CHECK(I2cBitBang_Recover(&bus) == I2C_RESULT_BUS_STUCK);
  CHECK(fake.master_sda_released == 1U);

  fake = (FakeI2c){0};
  fake.scl = 1U; fake.master_sda_released = 1U; fake.slave_holds_sda_low = 1U; fake.release_slave_sda_after_nine = 1U;
  bus = make_i2c_bus(&fake);
  uint8_t value = 0U;
  const I2cRecoveryRead attempt = I2cBitBang_ReadRegisterRecovering(&bus, 0x68U, 0x75U, &value);
  CHECK(attempt.initial_result == I2C_RESULT_BUS_STUCK);
  CHECK(attempt.recovery_attempted == 1U && attempt.recovery_result == I2C_RESULT_OK);
  CHECK(attempt.retried == 1U && attempt.final_result == I2C_RESULT_NACK);
  return 0;
}

static int test_mpu_signed_scaling_bias_and_filter(void)
{
  CHECK(Mpu6050_CombineSigned(0x7FU, 0xFFU) == INT16_MAX);
  CHECK(Mpu6050_CombineSigned(0x80U, 0x00U) == INT16_MIN);
  CHECK(Mpu6050_CombineSigned(0xFFU, 0xFFU) == -1);

  const uint8_t frame[14] = {
    0x40U, 0x00U, 0xC0U, 0x00U, 0x00U, 0x00U, 0x00U, 0x00U,
    0x00U, 0x83U, 0xFFU, 0x7DU, 0x00U, 0x00U
  };
  Mpu6050RawSample raw;
  Mpu6050ScaledSample scaled;
  const Mpu6050Bias bias = {{0, 0, 0}, {0, 0, 0}};
  Mpu6050_DecodeFrame(frame, &raw);
  CHECK(raw.accel[0] == 16384 && raw.accel[1] == -16384);
  CHECK(raw.gyro[0] == 131 && raw.gyro[1] == -131);
  Mpu6050_Scale(&raw, &bias, &scaled);
  CHECK(scaled.accel_mg[0] == 1000 && scaled.accel_mg[1] == -1000);
  CHECK(scaled.gyro_mdps[0] == 1000 && scaled.gyro_mdps[1] == -1000);

  Mpu6050Filter filter;
  Mpu6050_FilterInit(&filter);
  scaled.accel_mg[0] = 9000;
  scaled.gyro_mdps[0] = 900000;
  Mpu6050_FilterUpdate(&filter, &scaled);
  CHECK(filter.output.accel_mg[0] == 2000);
  CHECK(filter.output.gyro_mdps[0] == 250000);
  scaled.accel_mg[0] = -2000;
  scaled.gyro_mdps[0] = -250000;
  Mpu6050_FilterUpdate(&filter, &scaled);
  CHECK(filter.output.accel_mg[0] == 1000);
  CHECK(filter.output.gyro_mdps[0] == 125000);
  return 0;
}

typedef struct {
  uint8_t cs;
  uint8_t sck;
  uint8_t miso;
  uint32_t rising_edges;
  uint32_t falling_edges;
  uint32_t reads_while_high;
  uint32_t reads_while_low;
} FakeSoftSpi;

static void spi_cs(void *context, uint8_t level) { ((FakeSoftSpi *)context)->cs = level; }
static void spi_sck(void *context, uint8_t level)
{
  FakeSoftSpi *fake = context;
  if (level && !fake->sck) ++fake->rising_edges;
  if (!level && fake->sck) ++fake->falling_edges;
  fake->sck = level;
}
static void spi_mosi(void *context, uint8_t level) { (void)context; (void)level; }
static uint8_t spi_miso(void *context)
{
  FakeSoftSpi *fake = context;
  if (fake->sck) ++fake->reads_while_high; else ++fake->reads_while_low;
  return fake->miso;
}

static int test_software_spi_mode_zero_and_cs(void)
{
  FakeSoftSpi fake = {0U, 0U, 1U, 0U, 0U, 0U, 0U};
  SoftSpiIo io = {&fake, spi_cs, spi_sck, spi_mosi, spi_miso};
  SoftSpi_Init(&io);
  CHECK(fake.cs == 1U && fake.sck == 0U);
  SoftSpi_Select(&io);
  CHECK(fake.cs == 0U);
  CHECK(SoftSpi_TransferByte(&io, 0xA5U) == 0xFFU);
  CHECK(fake.cs == 0U);
  SoftSpi_Deselect(&io);
  CHECK(fake.cs == 1U && fake.sck == 0U);
  CHECK(fake.rising_edges == 8U && fake.falling_edges == 8U);
  CHECK(fake.reads_while_high == 8U && fake.reads_while_low == 0U);
  return 0;
}

typedef struct {
  uint8_t flash[W25Q64_SECTOR_SIZE];
  uint8_t selected;
  uint8_t command;
  uint8_t wel;
  uint8_t force_no_wel;
  uint8_t force_busy;
  uint8_t corrupt_restore;
  uint8_t busy_polls;
  uint32_t transfer_index;
  uint32_t address;
  uint32_t erase_count;
  uint32_t program_count;
  uint32_t begin_count;
  uint32_t end_count;
  uint32_t now_ms;
  uint32_t fail_begin_call;
  uint8_t mutation_observed;
  uint8_t unsafe_command;
  uint8_t unsafe_address;
} FakeW25;

static W25Q64_Result w25_begin(void *context)
{
  FakeW25 *fake = context;
  if (fake->selected) return W25Q64_RESULT_IO;
  ++fake->begin_count;
  if (fake->fail_begin_call == fake->begin_count) return W25Q64_RESULT_IO;
  fake->selected = 1U;
  fake->command = 0U;
  fake->transfer_index = 0U;
  fake->address = 0U;
  return W25Q64_RESULT_OK;
}

static W25Q64_Result w25_transfer(void *context, const uint8_t *tx, uint8_t *rx, uint32_t length)
{
  FakeW25 *fake = context;
  if (!fake->selected) return W25Q64_RESULT_IO;
  for (uint32_t index = 0U; index < length; ++index, ++fake->transfer_index) {
    const uint8_t outgoing = tx ? tx[index] : 0xFFU;
    uint8_t incoming = 0xFFU;
    if (fake->transfer_index == 0U) {
      fake->command = outgoing;
      if (outgoing == 0xC7U || outgoing == 0x60U) fake->unsafe_command = 1U;
    } else if (fake->command == 0x9FU && fake->transfer_index <= 3U) {
      static const uint8_t jedec[3] = {0xEFU, 0x40U, 0x17U};
      incoming = jedec[fake->transfer_index - 1U];
    } else if (fake->command == 0x05U) {
      incoming = (uint8_t)(fake->wel ? 0x02U : 0U);
      if (fake->force_busy || fake->busy_polls > 0U) incoming |= 0x01U;
      if (!fake->force_busy && fake->busy_polls > 0U) --fake->busy_polls;
      ++fake->now_ms;
    } else if ((fake->command == 0x03U || fake->command == 0x02U || fake->command == 0x20U) && fake->transfer_index <= 3U) {
      fake->address = (fake->address << 8U) | outgoing;
      if (fake->transfer_index == 3U && (fake->address < W25Q64_TEST_SECTOR_ADDRESS || fake->address >= W25Q64_TEST_SECTOR_ADDRESS + W25Q64_SECTOR_SIZE)) fake->unsafe_address = 1U;
    } else if (fake->command == 0x03U) {
      const uint32_t offset = fake->address - W25Q64_TEST_SECTOR_ADDRESS + fake->transfer_index - 4U;
      if (offset < W25Q64_SECTOR_SIZE) incoming = fake->flash[offset];
    } else if (fake->command == 0x02U && fake->wel) {
      const uint32_t offset = fake->address - W25Q64_TEST_SECTOR_ADDRESS + fake->transfer_index - 4U;
      if (offset < W25Q64_SECTOR_SIZE) {
        const uint8_t before = fake->flash[offset];
        fake->flash[offset] &= outgoing;
        if (fake->erase_count == 1U && fake->flash[offset] != before) fake->mutation_observed = 1U;
      }
    }
    if (rx) rx[index] = incoming;
  }
  return W25Q64_RESULT_OK;
}

static void w25_end(void *context)
{
  FakeW25 *fake = context;
  if (fake->command == 0x06U && !fake->force_no_wel) fake->wel = 1U;
  if (fake->command == 0x20U && fake->wel) {
    memset(fake->flash, 0xFF, sizeof(fake->flash));
    fake->wel = 0U;
    fake->busy_polls = 2U;
    ++fake->erase_count;
  }
  if (fake->command == 0x02U && fake->wel) {
    fake->wel = 0U;
    fake->busy_polls = 1U;
    ++fake->program_count;
    if (fake->corrupt_restore && fake->erase_count >= 2U && fake->program_count == 2U) fake->flash[0] ^= 1U;
  }
  fake->selected = 0U;
  ++fake->end_count;
}

static uint32_t w25_now_ms(void *context)
{
  return ((FakeW25 *)context)->now_ms;
}

static W25Q64_Bus make_w25_bus(FakeW25 *fake)
{
  W25Q64_Bus bus = {fake, w25_begin, w25_transfer, w25_end, w25_now_ms};
  return bus;
}

static int test_w25_boundaries_transactions_and_restore(void)
{
  const uint8_t expected_id[3] = {0xEFU, 0x40U, 0x17U};
  const uint8_t wrong_id[3] = {0xEFU, 0x40U, 0x18U};
  CHECK(W25Q64_IsExpectedJedecId(expected_id));
  CHECK(!W25Q64_IsExpectedJedecId(wrong_id));
  CHECK(W25Q64_TEST_SECTOR_ADDRESS == 0x007FF000U);
  CHECK(W25Q64_IsPageRangeValid(W25Q64_TEST_SECTOR_ADDRESS, 256U));
  CHECK(!W25Q64_IsPageRangeValid(W25Q64_TEST_SECTOR_ADDRESS + 255U, 2U));
  CHECK(!W25Q64_IsPageRangeValid(W25Q64_TEST_SECTOR_ADDRESS - 1U, 1U));
  CHECK(!W25Q64_IsPageRangeValid(W25Q64_TEST_SECTOR_ADDRESS + W25Q64_SECTOR_SIZE, 1U));

  FakeW25 fake = {0};
  uint8_t original[W25Q64_SECTOR_SIZE];
  uint8_t backup[W25Q64_SECTOR_SIZE];
  for (uint32_t index = 0U; index < W25Q64_SECTOR_SIZE; ++index) fake.flash[index] = (uint8_t)(index * 37U + 11U);
  memcpy(original, fake.flash, sizeof(original));
  W25Q64_Bus bus = make_w25_bus(&fake);
  CHECK(W25Q64_RunFixedSectorTest(&bus, backup) == W25Q64_RESULT_OK);
  CHECK(memcmp(backup, original, sizeof(original)) == 0);
  CHECK(memcmp(fake.flash, original, sizeof(original)) == 0);
  CHECK(fake.mutation_observed == 1U);
  CHECK(fake.erase_count == 2U);
  CHECK(fake.program_count == 17U);
  CHECK(fake.begin_count == fake.end_count && fake.selected == 0U);
  CHECK(fake.unsafe_command == 0U && fake.unsafe_address == 0U);

  fake = (FakeW25){0};
  for (uint32_t index = 0U; index < W25Q64_SECTOR_SIZE; ++index) fake.flash[index] = (uint8_t)(index * 13U + 7U);
  memcpy(original, fake.flash, sizeof(original));
  fake.fail_begin_call = 5U;
  bus = make_w25_bus(&fake);
  CHECK(W25Q64_RunFixedSectorTest(&bus, backup) == W25Q64_RESULT_IO);
  CHECK(fake.erase_count == 0U && fake.program_count == 0U);
  CHECK(memcmp(fake.flash, original, sizeof(original)) == 0);

  fake = (FakeW25){0};
  fake.force_no_wel = 1U;
  bus = make_w25_bus(&fake);
  CHECK(W25Q64_RunFixedSectorTest(&bus, backup) == W25Q64_RESULT_WEL);

  fake = (FakeW25){0};
  fake.force_busy = 1U;
  bus = make_w25_bus(&fake);
  CHECK(W25Q64_WaitReady(&bus, 10U) == W25Q64_RESULT_TIMEOUT);

  fake = (FakeW25){0};
  for (uint32_t index = 0U; index < W25Q64_SECTOR_SIZE; ++index) fake.flash[index] = (uint8_t)index;
  fake.corrupt_restore = 1U;
  bus = make_w25_bus(&fake);
  CHECK(W25Q64_RunFixedSectorTest(&bus, backup) == W25Q64_RESULT_RESTORE_FAILED);
  return 0;
}

int main(void)
{
  if (test_i2c_release_timeout_nack_and_recovery()) return 1;
  if (test_mpu_signed_scaling_bias_and_filter()) return 1;
  if (test_software_spi_mode_zero_and_cs()) return 1;
  if (test_w25_boundaries_transactions_and_restore()) return 1;
  puts("phase-05 host behavior: PASS");
  return 0;
}
