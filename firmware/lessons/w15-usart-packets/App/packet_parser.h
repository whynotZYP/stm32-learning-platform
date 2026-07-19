#ifndef PACKET_PARSER_H
#define PACKET_PARSER_H

#include <stdint.h>

enum {
  PACKET_SOF = 0xAAU,
  PACKET_MAX_PAYLOAD = 16U,
  PACKET_TIMEOUT_MS = 50U
};

typedef enum {
  PACKET_PARSER_NONE = 0,
  PACKET_PARSER_READY,
  PACKET_PARSER_CHECKSUM_ERROR,
  PACKET_PARSER_TIMEOUT,
  PACKET_PARSER_OVERSIZE
} PacketParserResult;

typedef enum {
  PACKET_STATE_WAIT_SOF = 0,
  PACKET_STATE_LENGTH,
  PACKET_STATE_COMMAND,
  PACKET_STATE_PAYLOAD,
  PACKET_STATE_CHECKSUM
} PacketParserState;

typedef struct {
  uint8_t command;
  uint8_t length;
  uint8_t payload[PACKET_MAX_PAYLOAD];
} PacketFrame;

typedef struct {
  PacketParserState state;
  uint8_t length;
  uint8_t command;
  uint8_t payload[PACKET_MAX_PAYLOAD];
  uint8_t payload_index;
  uint8_t checksum;
  uint32_t last_byte_ms;
} PacketParser;

void PacketParser_Init(PacketParser *parser);
PacketParserResult PacketParser_Push(PacketParser *parser, uint8_t byte, uint32_t now_ms, PacketFrame *frame);
PacketParserResult PacketParser_PollTimeout(PacketParser *parser, uint32_t now_ms);

#endif
