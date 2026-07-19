#include "device_protocol.h"

#include <ctype.h>
#include <stdio.h>
#include <string.h>

typedef struct {
  const char *cursor;
} JsonParser;

static void skip_whitespace(JsonParser *parser)
{
  while (*parser->cursor == ' ' || *parser->cursor == '\t' ||
         *parser->cursor == '\r' || *parser->cursor == '\n') {
    ++parser->cursor;
  }
}

static int consume(JsonParser *parser, char expected)
{
  skip_whitespace(parser);
  if (*parser->cursor != expected) return 0;
  ++parser->cursor;
  return 1;
}

static int is_hex_digit(char character)
{
  return isdigit((unsigned char)character) ||
         (character >= 'a' && character <= 'f') ||
         (character >= 'A' && character <= 'F');
}

static int parse_string(JsonParser *parser, char *output, size_t size,
                        int safe_identifier)
{
  size_t length = 0U;
  skip_whitespace(parser);
  if (*parser->cursor++ != '"') return 0;
  while (*parser->cursor != '\0' && *parser->cursor != '"') {
    unsigned char character = (unsigned char)*parser->cursor++;
    if (character < 0x20U) return 0;
    if (character == '\\') {
      char escaped;
      unsigned int index;
      if (safe_identifier) return 0;
      escaped = *parser->cursor++;
      if (escaped == 'u') {
        for (index = 0U; index < 4U; ++index) {
          if (!is_hex_digit(*parser->cursor++)) return 0;
        }
      } else if (strchr("\"\\/bfnrt", escaped) == NULL) {
        return 0;
      }
    } else if (safe_identifier &&
               !(isalnum(character) || character == '.' ||
                 character == '_' || character == '-')) {
      return 0;
    }
    if (++length >= size) return 0;
    if (output != NULL) output[length - 1U] = (char)character;
  }
  if (*parser->cursor++ != '"' || length == 0U) return 0;
  if (output != NULL) output[length] = '\0';
  return 1;
}

static int consume_literal(JsonParser *parser, const char *literal)
{
  size_t length = strlen(literal);
  skip_whitespace(parser);
  if (strncmp(parser->cursor, literal, length) != 0) return 0;
  parser->cursor += length;
  return 1;
}

static int parse_number(JsonParser *parser, int *is_version_one)
{
  const char *start;
  skip_whitespace(parser);
  start = parser->cursor;
  if (*parser->cursor == '-') ++parser->cursor;
  if (*parser->cursor == '0') {
    ++parser->cursor;
    if (isdigit((unsigned char)*parser->cursor)) return 0;
  } else {
    if (!isdigit((unsigned char)*parser->cursor)) return 0;
    while (isdigit((unsigned char)*parser->cursor)) ++parser->cursor;
  }
  if (*parser->cursor == '.') {
    ++parser->cursor;
    if (!isdigit((unsigned char)*parser->cursor)) return 0;
    while (isdigit((unsigned char)*parser->cursor)) ++parser->cursor;
  }
  if (*parser->cursor == 'e' || *parser->cursor == 'E') {
    ++parser->cursor;
    if (*parser->cursor == '+' || *parser->cursor == '-') ++parser->cursor;
    if (!isdigit((unsigned char)*parser->cursor)) return 0;
    while (isdigit((unsigned char)*parser->cursor)) ++parser->cursor;
  }
  if (is_version_one != NULL) {
    *is_version_one = parser->cursor - start == 1 && *start == '1';
  }
  return 1;
}

static int parse_params(JsonParser *parser)
{
  unsigned int entries = 0U;
  if (!consume(parser, '{')) return 0;
  skip_whitespace(parser);
  if (*parser->cursor == '}') {
    ++parser->cursor;
    return 1;
  }
  for (;;) {
    if (++entries > 16U || !parse_string(parser, NULL, 65U, 0) ||
        !consume(parser, ':')) return 0;
    skip_whitespace(parser);
    if (*parser->cursor == '"') {
      if (!parse_string(parser, NULL, 161U, 0)) return 0;
    } else if (!consume_literal(parser, "true") &&
               !consume_literal(parser, "false") &&
               !parse_number(parser, NULL)) {
      return 0;
    }
    skip_whitespace(parser);
    if (*parser->cursor == '}') {
      ++parser->cursor;
      return 1;
    }
    if (!consume(parser, ',')) return 0;
  }
}

DeviceParseStatus DeviceProtocol_ParseLine(const char *line,
                                           DeviceRequest *request)
{
  JsonParser parser;
  char key[8];
  char type[5];
  unsigned int seen = 0U;
  size_t length;

  if (line == NULL || request == NULL) {
    return DEVICE_PARSE_INVALID_REQUEST;
  }
  length = strlen(line);
  if (length < 2U || length > DEVICE_PROTOCOL_MAX_LINE) {
    return DEVICE_PARSE_INVALID_REQUEST;
  }
  parser.cursor = line;
  if (!consume(&parser, '{')) return DEVICE_PARSE_INVALID_REQUEST;
  for (;;) {
    unsigned int field;
    int version_one = 0;
    if (!parse_string(&parser, key, sizeof(key), 1) ||
        !consume(&parser, ':')) return DEVICE_PARSE_INVALID_REQUEST;
    if (strcmp(key, "v") == 0) field = 1U;
    else if (strcmp(key, "id") == 0) field = 2U;
    else if (strcmp(key, "type") == 0) field = 4U;
    else if (strcmp(key, "test") == 0) field = 8U;
    else if (strcmp(key, "params") == 0) field = 16U;
    else return DEVICE_PARSE_INVALID_REQUEST;
    if ((seen & field) != 0U) return DEVICE_PARSE_INVALID_REQUEST;
    seen |= field;
    if (field == 1U) {
      if (!parse_number(&parser, &version_one)) return DEVICE_PARSE_INVALID_REQUEST;
      if (!version_one) return DEVICE_PARSE_UNSUPPORTED_VERSION;
    } else if (field == 2U) {
      if (!parse_string(&parser, request->id, sizeof(request->id), 1))
        return DEVICE_PARSE_INVALID_REQUEST;
    } else if (field == 4U) {
      if (!parse_string(&parser, type, sizeof(type), 1) ||
          strcmp(type, "run") != 0) return DEVICE_PARSE_INVALID_REQUEST;
    } else if (field == 8U) {
      if (!parse_string(&parser, request->test, sizeof(request->test), 1))
        return DEVICE_PARSE_INVALID_REQUEST;
    } else if (!parse_params(&parser)) {
      return DEVICE_PARSE_INVALID_REQUEST;
    }
    skip_whitespace(&parser);
    if (*parser.cursor == '}') {
      ++parser.cursor;
      break;
    }
    if (!consume(&parser, ',')) return DEVICE_PARSE_INVALID_REQUEST;
  }
  skip_whitespace(&parser);
  if (*parser.cursor != '\0' || seen != 31U) return DEVICE_PARSE_INVALID_REQUEST;
  return DEVICE_PARSE_OK;
}

int DeviceProtocol_FormatResult(char *output, size_t size, const char *id,
                                const char *test, int passed,
                                const char *details_json)
{
  return snprintf(output, size,
                  "{\"v\":1,\"id\":\"%s\",\"type\":\"result\","
                  "\"test\":\"%s\",\"status\":\"%s\",\"details\":%s}\n",
                  id, test, passed ? "pass" : "fail", details_json);
}

int DeviceProtocol_FormatError(char *output, size_t size, const char *id,
                               const char *test, const char *code,
                               const char *message)
{
  return snprintf(output, size,
                  "{\"v\":1,\"id\":\"%s\",\"type\":\"error\","
                  "\"test\":\"%s\",\"code\":\"%s\",\"message\":\"%s\"}\n",
                  id, test, code, message);
}
