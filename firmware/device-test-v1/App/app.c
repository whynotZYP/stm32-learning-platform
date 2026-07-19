#include "app.h"

#include <stdio.h>
#include <string.h>

#include "device_protocol.h"
#include "device_tests.h"
#include "device_tests_stm32.h"
#include "usart.h"

static char input_line[DEVICE_PROTOCOL_MAX_LINE + 1U];
static size_t input_length;
static int discarding_line;
static char output_line[384];

static void send_line(const char *line)
{
  HAL_UART_Transmit(&huart1, (uint8_t *)line, (uint16_t)strlen(line), 1000U);
}

static const char *error_code(DeviceTestStatus status)
{
  if (status == DEVICE_TEST_PRECONDITION) return "PRECONDITION";
  if (status == DEVICE_TEST_TIMEOUT) return "TIMEOUT";
  return "HARDWARE";
}

static void handle_request(const char *line)
{
  DeviceRequest request;
  DeviceParseStatus parse_status = DeviceProtocol_ParseLine(line, &request);
  DeviceTestOutcome result;

  if (parse_status != DEVICE_PARSE_OK) {
    DeviceProtocol_FormatError(output_line, sizeof(output_line), "unknown",
                               "system.hello",
                               parse_status == DEVICE_PARSE_UNSUPPORTED_VERSION
                                   ? "UNSUPPORTED_VERSION" : "INVALID_REQUEST",
                               "request must use bounded JSON protocol v1");
    send_line(output_line);
    return;
  }
  if (!DeviceTests_IsKnown(request.test)) {
    DeviceProtocol_FormatError(output_line, sizeof(output_line), request.id,
                               request.test, "UNKNOWN_TEST",
                               "test is not in the safe registry");
    send_line(output_line);
    return;
  }
  snprintf(output_line, sizeof(output_line),
           "{\"v\":1,\"id\":\"%s\",\"type\":\"progress\","
           "\"test\":\"%s\",\"step\":\"running on STM32\",\"percent\":10}\n",
           request.id, request.test);
  send_line(output_line);
  result = DeviceTestsStm32_Run(request.test);
  if (result.status == DEVICE_TEST_PASS || result.status == DEVICE_TEST_FAIL) {
    DeviceProtocol_FormatResult(output_line, sizeof(output_line), request.id,
                                request.test, result.status == DEVICE_TEST_PASS,
                                result.details);
  } else {
    DeviceProtocol_FormatError(output_line, sizeof(output_line), request.id,
                               request.test, error_code(result.status),
                               result.message);
  }
  send_line(output_line);
}

void App_Init(void)
{
  input_length = 0U;
  discarding_line = 0;
  DeviceTestsStm32_Init();
}

void App_Run(void)
{
  uint8_t character;
  if (HAL_UART_Receive(&huart1, &character, 1U, 10U) != HAL_OK) return;
  if (discarding_line) {
    if (character == '\n') discarding_line = 0;
    return;
  }
  if (character == '\0') {
    input_length = 0U;
    discarding_line = 1;
    DeviceProtocol_FormatError(output_line, sizeof(output_line), "unknown",
                               "system.hello", "INVALID_REQUEST",
                               "request line contains a NUL byte");
    send_line(output_line);
    return;
  }
  if (character == '\n') {
    input_line[input_length] = '\0';
    if (input_length > 0U) handle_request(input_line);
    input_length = 0U;
    return;
  }
  if (input_length + 1U < sizeof(input_line)) {
    input_line[input_length++] = (char)character;
  } else {
    input_length = 0U;
    discarding_line = 1;
    DeviceProtocol_FormatError(output_line, sizeof(output_line), "unknown",
                               "system.hello", "INVALID_REQUEST",
                               "request line exceeds 512 bytes");
    send_line(output_line);
  }
}
