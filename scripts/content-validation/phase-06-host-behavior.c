#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "app_logic.h"
#include "capstone_clock.h"
#include "clock_logic.h"
#include "display.h"
#include "flash_store.h"
#include "health.h"
#include "reliability_logic.h"
#include "sensors.h"
#include "storage.h"

#define CHECK(condition) do { \
  if (!(condition)) { \
    fprintf(stderr, "CHECK failed at line %d: %s\n", __LINE__, #condition); \
    return 1; \
  } \
} while (0)

typedef struct {
  uint16_t high_values[4];
  uint16_t low_values[4];
  uint8_t high_index;
  uint8_t low_index;
} CounterFixture;

static uint16_t read_counter_part(void *context, ClockCounterPart part)
{
  CounterFixture *fixture = (CounterFixture *)context;
  return (part == CLOCK_COUNTER_HIGH) ? fixture->high_values[fixture->high_index++] : fixture->low_values[fixture->low_index++];
}

typedef struct {
  uint16_t page[FLASH_STORE_PAGE_HALFWORDS];
  uint8_t unlocked;
  uint8_t erase_calls;
  uint8_t lock_calls;
  int fail_program_after;
  uint8_t fail_restore;
  uint8_t program_failure_seen;
  int program_calls;
} FakeFlash;

static uint16_t fake_flash_read(void *context, uint16_t index) { return ((FakeFlash *)context)->page[index]; }
static int fake_flash_unlock(void *context) { ((FakeFlash *)context)->unlocked = 1U; return 0; }
static int fake_flash_erase(void *context) { FakeFlash *flash = context; memset(flash->page, 0xff, sizeof(flash->page)); ++flash->erase_calls; return 0; }
static int fake_flash_program(void *context, uint16_t index, uint16_t value) {
  FakeFlash *flash = context;
  int call = flash->program_calls++;
  if (flash->fail_program_after >= 0 && call == flash->fail_program_after) {
    flash->program_failure_seen = 1U;
    return -1;
  }
  if (flash->program_failure_seen != 0U && flash->fail_restore != 0U) return -1;
  flash->page[index] = value;
  return 0;
}
static void fake_flash_lock(void *context) { FakeFlash *flash = context; flash->unlocked = 0U; ++flash->lock_calls; }

static int test_clock_and_reliability(void)
{
  CounterFixture counter = {{0x1234U, 0x1235U, 0x1235U}, {0xffffU, 0x0002U}, 0U, 0U};
  ReliabilityLogic reliability;
  CHECK(ClockLogic_NeedsInitialization(0U) == 1U);
  CHECK(ClockLogic_NeedsInitialization(CLOCK_BACKUP_MARKER) == 0U);
  CHECK(ClockLogic_ReadCounterConsistent(read_counter_part, &counter) == 0x12350002UL);
  ReliabilityLogic_Init(&reliability, 0x15U, 1U, 1U);
  CHECK(reliability.reset_flags == 0x15U && reliability.standby_wakeup == 1U && reliability.wakeup_flag == 1U);
  ReliabilityLogic_ReportProgress(&reliability);
  CHECK(ReliabilityLogic_TakeWatchdogFeed(&reliability) == 1U);
  CHECK(ReliabilityLogic_TakeWatchdogFeed(&reliability) == 0U);
  CHECK(ReliabilityLogic_NeedsClockRestore(RELIABILITY_POWER_STOP) == 1U);
  CHECK(ReliabilityLogic_NeedsClockRestore(RELIABILITY_POWER_SLEEP) == 0U);
  return 0;
}

static int test_flash_transaction_and_restore(void)
{
  FakeFlash flash;
  FlashStoreWorkspace workspace;
  FlashStoreIo io = {fake_flash_read, fake_flash_unlock, fake_flash_erase, fake_flash_program, fake_flash_lock, &flash};
  const uint8_t payload[] = {0x11U, 0x22U, 0x33U, 0x44U};
  memset(&flash, 0, sizeof(flash));
  for (uint16_t index = 0U; index < FLASH_STORE_PAGE_HALFWORDS; ++index) flash.page[index] = (uint16_t)(0x8000U + index);
  flash.fail_program_after = -1;
  CHECK(FlashStore_Update(&io, &workspace, 4U, payload, sizeof(payload)) == FLASH_STORE_OK);
  CHECK(flash.page[2] == 0x2211U && flash.page[3] == 0x4433U);
  CHECK(flash.unlocked == 0U && flash.lock_calls == 1U);

  for (uint16_t index = 0U; index < FLASH_STORE_PAGE_HALFWORDS; ++index) flash.page[index] = (uint16_t)(0x4000U + index);
  flash.fail_program_after = 3;
  flash.program_calls = 0;
  flash.erase_calls = 0U;
  flash.lock_calls = 0U;
  CHECK(FlashStore_Update(&io, &workspace, 4U, payload, sizeof(payload)) == FLASH_STORE_ERROR);
  CHECK(flash.erase_calls == 2U);
  CHECK(flash.page[0] == 0x4000U && flash.page[2] == 0x4002U);
  CHECK(flash.unlocked == 0U && flash.lock_calls == 1U);

  for (uint16_t index = 0U; index < FLASH_STORE_PAGE_HALFWORDS; ++index) flash.page[index] = (uint16_t)(0x2000U + index);
  flash.fail_program_after = 3;
  flash.fail_restore = 1U;
  flash.program_failure_seen = 0U;
  flash.program_calls = 0;
  flash.erase_calls = 0U;
  flash.lock_calls = 0U;
  CHECK(FlashStore_Update(&io, &workspace, 4U, payload, sizeof(payload)) == FLASH_STORE_RESTORE_FAILED);
  CHECK(flash.erase_calls == 2U);
  CHECK(flash.unlocked == 0U && flash.lock_calls == 1U);
  return 0;
}

typedef struct {
  uint8_t sample_calls;
  uint8_t store_calls;
  uint8_t display_calls;
  uint8_t feed_calls;
  SensorSnapshot snapshot;
  uint32_t timestamp;
} CapstoneFixture;

static int fake_sample(void *context, SensorSnapshot *snapshot) { CapstoneFixture *fixture = context; ++fixture->sample_calls; *snapshot = fixture->snapshot; return 0; }
static int fake_store(void *context, const SensorSnapshot *snapshot, uint32_t timestamp) { CapstoneFixture *fixture = context; ++fixture->store_calls; CHECK(snapshot->light_raw == fixture->snapshot.light_raw); CHECK(timestamp == fixture->timestamp); return 0; }
static int fake_display(void *context, const SensorSnapshot *snapshot, uint32_t timestamp) { CapstoneFixture *fixture = context; ++fixture->display_calls; CHECK(snapshot->temperature_raw == fixture->snapshot.temperature_raw); CHECK(timestamp == fixture->timestamp); return 0; }
static uint32_t fake_time(void *context) { return ((CapstoneFixture *)context)->timestamp; }
static void fake_feed(void *context) { ++((CapstoneFixture *)context)->feed_calls; }

static int test_record_recovery_and_capstone_scheduler(void)
{
  uint8_t log[128];
  uint8_t first[48];
  uint8_t second[48];
  SensorSnapshot snapshot = {123U, 456U, 7, -8, 9};
  StorageRecordView view;
  size_t first_length = Storage_EncodeRecord(first, sizeof(first), 100U, (const uint8_t *)&snapshot, sizeof(snapshot));
  size_t second_length = Storage_EncodeRecord(second, sizeof(second), 200U, (const uint8_t *)&snapshot, sizeof(snapshot));
  CHECK(first_length > 0U && second_length > 0U);
  first[first_length - 1U] ^= 0x55U;
  memcpy(log, first, first_length);
  memcpy(log + first_length, second, second_length);
  CHECK(Storage_FindNextValidRecord(log, first_length + second_length, 0U, &view) == 1U);
  CHECK(view.offset == first_length && view.timestamp_utc == 200U && view.length == sizeof(snapshot));

  {
    HealthState health;
    Health_Init(&health);
    Health_ReportProgress(&health, HEALTH_PROGRESS_SAMPLE);
    CHECK(Health_TakeFeedPermission(&health) == 0U);
    Health_ReportProgress(&health, HEALTH_PROGRESS_STORAGE);
    CHECK(Health_TakeFeedPermission(&health) == 0U);
    Health_ReportProgress(&health, HEALTH_PROGRESS_DISPLAY);
    CHECK(Health_TakeFeedPermission(&health) == 1U);
    CHECK(Health_TakeFeedPermission(&health) == 0U);
  }

  {
    CapstoneFixture fixture = {0U, 0U, 0U, 0U, snapshot, 1704067200UL};
    CapstoneAppState app;
    CapstoneAppIo io = {fake_sample, fake_store, fake_display, fake_time, fake_feed, &fixture};
    CapstoneApp_Init(&app, 1000U);
    CHECK(CapstoneApp_Run(&app, &io, 1999U) == 0U);
    CHECK(CapstoneApp_Run(&app, &io, 2000U) == 1U);
    CHECK(app.state == CAPSTONE_STATE_STORE && fixture.sample_calls == 1U);
    CHECK(CapstoneApp_Run(&app, &io, 2000U) == 1U);
    CHECK(app.state == CAPSTONE_STATE_DISPLAY && fixture.store_calls == 1U);
    CHECK(CapstoneApp_Run(&app, &io, 2000U) == 1U);
    CHECK(app.state == CAPSTONE_STATE_WAIT && fixture.display_calls == 1U && fixture.feed_calls == 1U);
  }

  {
    DisplayState display;
    SensorsState sensors;
    Sensors_Init(&sensors);
    Sensors_Commit(&sensors, &snapshot);
    Display_Init(&display);
    Display_Commit(&display, &snapshot, 1704067200UL);
    CHECK(sensors.latest.light_raw == 123U && display.render_count == 1U);
    CHECK(CapstoneClock_IsUtc() == 1U);
  }
  return 0;
}

int main(void)
{
  if (test_clock_and_reliability() != 0) return 1;
  if (test_flash_transaction_and_restore() != 0) return 1;
  if (test_record_recovery_and_capstone_scheduler() != 0) return 1;
  puts("phase-06 host behavior: PASS");
  return 0;
}
