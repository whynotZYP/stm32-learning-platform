#ifndef DEVICE_PROTOCOL_H
#define DEVICE_PROTOCOL_H

#include <stddef.h>

#define DEVICE_REQUEST_ID_SIZE 65U
#define DEVICE_TEST_ID_SIZE 65U
#define DEVICE_PROTOCOL_MAX_LINE 512U

typedef enum {
  DEVICE_PARSE_OK = 0,
  DEVICE_PARSE_INVALID_REQUEST,
  DEVICE_PARSE_UNSUPPORTED_VERSION
} DeviceParseStatus;

typedef struct {
  char id[DEVICE_REQUEST_ID_SIZE];
  char test[DEVICE_TEST_ID_SIZE];
} DeviceRequest;

DeviceParseStatus DeviceProtocol_ParseLine(const char *line, DeviceRequest *request);
int DeviceProtocol_FormatResult(char *output, size_t size, const char *id,
                                const char *test, int passed,
                                const char *details_json);
int DeviceProtocol_FormatError(char *output, size_t size, const char *id,
                               const char *test, const char *code,
                               const char *message);

#endif
