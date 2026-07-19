#include <stdio.h>
#include <string.h>

#include "device_protocol.h"
#include "device_tests.h"

#define CHECK(condition) do { if (!(condition)) { fprintf(stderr, "check failed at %d: %s\n", __LINE__, #condition); return 1; } } while (0)

int main(void)
{
  static const char *const expected[] = {
    "system.hello", "system.chip-id", "gpio.loopback", "exti.event-count",
    "tim.pwm-capture", "adc.range-dma", "dma.memory-copy", "usart.packet",
    "i2c.mpu6050-id", "spi.flash-id", "spi.flash-roundtrip", "rtc.bkp",
    "wdg.reset-cause", "flash.reserved-page", "pwr.sleep-wake"
  };
  static const char padded_request[] = "{\"v\":1,\"id\":\"r\",\"type\":\"run\",\"test\":\"system.hello\",\"params\":{}}";
  DeviceRequest request;
  char padded[514];
  char output[256];
  size_t index;

  CHECK(DeviceProtocol_ParseLine("{\"v\":1,\"id\":\"req-42\",\"type\":\"run\",\"test\":\"spi.flash-id\",\"params\":{}}", &request) == DEVICE_PARSE_OK);
  CHECK(strcmp(request.id, "req-42") == 0);
  CHECK(strcmp(request.test, "spi.flash-id") == 0);
  CHECK(DeviceProtocol_ParseLine("{\"v\":2,\"id\":\"r\",\"type\":\"run\",\"test\":\"system.hello\",\"params\":{}}", &request) == DEVICE_PARSE_UNSUPPORTED_VERSION);
  CHECK(DeviceProtocol_ParseLine("{\"v\":10,\"id\":\"r\",\"type\":\"run\",\"test\":\"system.hello\",\"params\":{}}", &request) == DEVICE_PARSE_UNSUPPORTED_VERSION);
  CHECK(DeviceProtocol_ParseLine("{\"v\":1.5,\"id\":\"r\",\"type\":\"run\",\"test\":\"system.hello\",\"params\":{}}", &request) != DEVICE_PARSE_OK);
  CHECK(DeviceProtocol_ParseLine(" { \"test\" : \"system.hello\", \"params\" : {}, \"type\" : \"run\", \"id\" : \"r\", \"v\" : 1 } ", &request) == DEVICE_PARSE_OK);
  CHECK(DeviceProtocol_ParseLine("{\"v\":1,\"id\":\"r\",\"type\":\"run\",\"test\":\"system.hello\",\"params\":{}} trailing", &request) == DEVICE_PARSE_INVALID_REQUEST);
  CHECK(DeviceProtocol_ParseLine("{\"v\":1,\"id\":\"../bad\",\"type\":\"run\",\"test\":\"system.hello\",\"params\":{}}", &request) == DEVICE_PARSE_INVALID_REQUEST);
  CHECK(DeviceProtocol_ParseLine("not-json", &request) == DEVICE_PARSE_INVALID_REQUEST);
  padded[0] = '{';
  memset(padded + 1U, ' ', 513U - sizeof(padded_request));
  memcpy(padded + 514U - sizeof(padded_request), padded_request + 1U,
         sizeof(padded_request) - 2U);
  padded[512] = '\0';
  CHECK(DeviceProtocol_ParseLine(padded, &request) == DEVICE_PARSE_OK);
  padded[512] = ' ';
  padded[513] = '\0';
  CHECK(DeviceProtocol_ParseLine(padded, &request) == DEVICE_PARSE_INVALID_REQUEST);

  CHECK(DeviceTests_Count() == sizeof(expected) / sizeof(expected[0]));
  for (index = 0; index < DeviceTests_Count(); ++index) {
    CHECK(strcmp(DeviceTests_IdAt(index), expected[index]) == 0);
    CHECK(DeviceTests_IsKnown(expected[index]) != 0);
  }
  CHECK(DeviceTests_IsKnown("flash.mass-erase") == 0);

  CHECK(DeviceProtocol_FormatResult(output, sizeof(output), "req-42", "system.hello", 1, "{\"firmware\":\"device-test-v1\",\"protocol\":1}") > 0);
  CHECK(strcmp(output, "{\"v\":1,\"id\":\"req-42\",\"type\":\"result\",\"test\":\"system.hello\",\"status\":\"pass\",\"details\":{\"firmware\":\"device-test-v1\",\"protocol\":1}}\n") == 0);
  CHECK(DeviceProtocol_FormatError(output, sizeof(output), "r", "system.hello", "PRECONDITION", "wiring required") > 0);
  CHECK(strstr(output, "\"code\":\"PRECONDITION\"") != NULL);
  return 0;
}
