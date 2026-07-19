#include "packet_parser.h"

static void reset(PacketParser *parser)
{
  parser->state = PACKET_STATE_WAIT_SOF;
  parser->length = 0U;
  parser->command = 0U;
  parser->payload_index = 0U;
  parser->checksum = 0U;
}

void PacketParser_Init(PacketParser *parser)
{
  reset(parser);
  parser->last_byte_ms = 0U;
}

PacketParserResult PacketParser_PollTimeout(PacketParser *parser, uint32_t now_ms)
{
  if (parser->state != PACKET_STATE_WAIT_SOF && (uint32_t)(now_ms - parser->last_byte_ms) > PACKET_TIMEOUT_MS) {
    reset(parser);
    return PACKET_PARSER_TIMEOUT;
  }
  return PACKET_PARSER_NONE;
}

PacketParserResult PacketParser_Push(PacketParser *parser, uint8_t byte, uint32_t now_ms, PacketFrame *frame)
{
  PacketParserResult timeout = PacketParser_PollTimeout(parser, now_ms);
  parser->last_byte_ms = now_ms;

  switch (parser->state) {
    case PACKET_STATE_WAIT_SOF:
      if (byte == PACKET_SOF) parser->state = PACKET_STATE_LENGTH;
      break;
    case PACKET_STATE_LENGTH:
      if (byte > PACKET_MAX_PAYLOAD) {
        reset(parser);
        if (byte == PACKET_SOF) parser->state = PACKET_STATE_LENGTH;
        return PACKET_PARSER_OVERSIZE;
      }
      parser->length = byte;
      parser->checksum = byte;
      parser->state = PACKET_STATE_COMMAND;
      break;
    case PACKET_STATE_COMMAND:
      parser->command = byte;
      parser->checksum = (uint8_t)(parser->checksum + byte);
      parser->state = parser->length == 0U ? PACKET_STATE_CHECKSUM : PACKET_STATE_PAYLOAD;
      break;
    case PACKET_STATE_PAYLOAD:
      parser->payload[parser->payload_index] = byte;
      parser->payload_index = (uint8_t)(parser->payload_index + 1U);
      parser->checksum = (uint8_t)(parser->checksum + byte);
      if (parser->payload_index == parser->length) parser->state = PACKET_STATE_CHECKSUM;
      break;
    case PACKET_STATE_CHECKSUM:
      if ((uint8_t)(parser->checksum + byte) != 0U) {
        reset(parser);
        if (byte == PACKET_SOF) parser->state = PACKET_STATE_LENGTH;
        return PACKET_PARSER_CHECKSUM_ERROR;
      }
      frame->command = parser->command;
      frame->length = parser->length;
      for (uint8_t index = 0U; index < parser->length; ++index) frame->payload[index] = parser->payload[index];
      reset(parser);
      return PACKET_PARSER_READY;
    default:
      reset(parser);
      break;
  }
  return timeout;
}
