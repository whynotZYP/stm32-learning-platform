#include <stdint.h>

#include "dma_snapshot.h"
#include "mpu6050_id.h"
#include "packet_parser.h"
#include "usart_rx.h"

#ifndef TEST_CASE
#define TEST_CASE 0
#endif

static uint8_t checksum(uint8_t length, uint8_t command, const uint8_t *payload)
{
  uint8_t sum = (uint8_t)(length + command);
  uint8_t index;
  for (index = 0U; index < length; ++index) sum = (uint8_t)(sum + payload[index]);
  return (uint8_t)(0U - sum);
}

static int dma_first_frame(void)
{
  DmaSnapshotStore store;
  DmaSnapshot snapshot;
  uint16_t frame[DMA_SNAPSHOT_CHANNELS] = {101U, 202U, 303U, 404U};
  DmaSnapshot_Init(&store);
  DmaSnapshot_Publish(&store, frame);
  return DmaSnapshot_Read(&store, &snapshot) && snapshot.sequence == 1U && snapshot.values[0] == 101U && snapshot.values[3] == 404U;
}

static int dma_source_changes(void)
{
  DmaSnapshotStore store;
  DmaSnapshot snapshot;
  uint16_t frame[DMA_SNAPSHOT_CHANNELS] = {11U, 22U, 33U, 44U};
  DmaSnapshot_Init(&store);
  DmaSnapshot_Publish(&store, frame);
  frame[0] = 900U;
  frame[1] = 901U;
  return DmaSnapshot_Read(&store, &snapshot) && snapshot.values[0] == 11U && snapshot.values[1] == 22U;
}

static int usart_rearm(void)
{
  UsartRxState state;
  uint8_t value = 0U;
  UsartRx_Init(&state);
  return UsartRx_OnByte(&state, 0x5AU) == USART_RX_ACTION_REARM && UsartRx_Pop(&state, &value) && value == 0x5AU;
}

static int usart_ore(void)
{
  UsartRxState state;
  UsartRxAction action;
  UsartRx_Init(&state);
  action = UsartRx_OnError(&state, USART_RX_ERROR_ORE);
  return (action & USART_RX_ACTION_CLEAR_ORE) != 0 && (action & USART_RX_ACTION_REARM) != 0 && state.error_count == 1U && state.ore_count == 1U;
}

static int packet_partial(void)
{
  PacketParser parser;
  PacketFrame frame;
  uint8_t payload[2] = {0x10U, 0x20U};
  uint8_t bytes[6] = {PACKET_SOF, 2U, 0x31U, 0x10U, 0x20U, 0U};
  uint8_t index;
  bytes[5] = checksum(2U, 0x31U, payload);
  PacketParser_Init(&parser);
  for (index = 0U; index < 5U; ++index) if (PacketParser_Push(&parser, bytes[index], index, &frame) != PACKET_PARSER_NONE) return 0;
  return PacketParser_Push(&parser, bytes[5], 5U, &frame) == PACKET_PARSER_READY && frame.command == 0x31U && frame.length == 2U && frame.payload[1] == 0x20U;
}

static int packet_concat(void)
{
  PacketParser parser;
  PacketFrame frame;
  uint8_t first_payload[1] = {0x11U};
  uint8_t second_payload[1] = {0x22U};
  uint8_t bytes[10] = {PACKET_SOF, 1U, 1U, 0x11U, 0U, PACKET_SOF, 1U, 2U, 0x22U, 0U};
  uint8_t index;
  uint8_t ready = 0U;
  bytes[4] = checksum(1U, 1U, first_payload);
  bytes[9] = checksum(1U, 2U, second_payload);
  PacketParser_Init(&parser);
  for (index = 0U; index < 10U; ++index) if (PacketParser_Push(&parser, bytes[index], index, &frame) == PACKET_PARSER_READY) ready = (uint8_t)(ready + 1U);
  return ready == 2U && frame.command == 2U && frame.payload[0] == 0x22U;
}

static int packet_bad_checksum(void)
{
  PacketParser parser;
  PacketFrame frame;
  uint8_t bytes[5] = {PACKET_SOF, 1U, 7U, 0x44U, 0x99U};
  uint8_t index;
  PacketParser_Init(&parser);
  for (index = 0U; index < 4U; ++index) (void)PacketParser_Push(&parser, bytes[index], index, &frame);
  return PacketParser_Push(&parser, bytes[4], 4U, &frame) == PACKET_PARSER_CHECKSUM_ERROR;
}

static int packet_timeout(void)
{
  PacketParser parser;
  PacketFrame frame;
  PacketParser_Init(&parser);
  (void)PacketParser_Push(&parser, PACKET_SOF, 10U, &frame);
  (void)PacketParser_Push(&parser, 3U, 11U, &frame);
  (void)PacketParser_Push(&parser, 9U, 12U, &frame);
  return PacketParser_PollTimeout(&parser, 12U + PACKET_TIMEOUT_MS + 1U) == PACKET_PARSER_TIMEOUT;
}

static int packet_oversize(void)
{
  PacketParser parser;
  PacketFrame frame;
  PacketParser_Init(&parser);
  (void)PacketParser_Push(&parser, PACKET_SOF, 0U, &frame);
  return PacketParser_Push(&parser, (uint8_t)(PACKET_MAX_PAYLOAD + 1U), 1U, &frame) == PACKET_PARSER_OVERSIZE && parser.payload_index == 0U;
}

static int mpu_addresses(void)
{
  return MPU6050_ADDRESS_7BIT == 0x68U && MPU6050_HAL_ADDRESS == (0x68U << 1) && MPU6050_WHO_AM_I_REGISTER == 0x75U && MPU6050_EXPECTED_ID == 0x68U;
}

static int mpu_classification(void)
{
  return Mpu6050_ClassifyWhoAmI(MPU6050_TRANSPORT_TIMEOUT, 0U) == MPU6050_ID_TIMEOUT &&
    Mpu6050_ClassifyWhoAmI(MPU6050_TRANSPORT_ERROR, 0U) == MPU6050_ID_BUS_ERROR &&
    Mpu6050_ClassifyWhoAmI(MPU6050_TRANSPORT_OK, 0x69U) == MPU6050_ID_WRONG &&
    Mpu6050_ClassifyWhoAmI(MPU6050_TRANSPORT_OK, 0x68U) == MPU6050_ID_OK;
}

static PacketParserResult push_valid(PacketParser *parser, uint32_t start_ms, PacketFrame *frame)
{
  uint8_t payload[1] = {0x55U};
  uint8_t bytes[5] = {PACKET_SOF, 1U, 3U, 0x55U, 0U};
  uint8_t index;
  PacketParserResult result = PACKET_PARSER_NONE;
  bytes[4] = checksum(1U, 3U, payload);
  for (index = 0U; index < 5U; ++index) result = PacketParser_Push(parser, bytes[index], start_ms + index, frame);
  return result;
}

static int packet_drop_recovery(void)
{
  PacketParser parser;
  PacketFrame frame;
  uint8_t payload[1] = {0x55U};
  uint8_t remainder[4] = {1U, 3U, 0x55U, 0U};
  uint8_t index;
  PacketParserResult result;
  remainder[3] = checksum(1U, 3U, payload);
  PacketParser_Init(&parser);
  (void)PacketParser_Push(&parser, PACKET_SOF, 0U, &frame);
  (void)PacketParser_Push(&parser, 2U, 1U, &frame);
  (void)PacketParser_Push(&parser, 4U, 2U, &frame);
  (void)PacketParser_Push(&parser, 0x11U, 3U, &frame);
  if (PacketParser_Push(&parser, PACKET_SOF, PACKET_TIMEOUT_MS + 4U, &frame) != PACKET_PARSER_TIMEOUT) return 0;
  result = PACKET_PARSER_NONE;
  for (index = 0U; index < 4U; ++index) result = PacketParser_Push(&parser, remainder[index], PACKET_TIMEOUT_MS + 5U + index, &frame);
  return result == PACKET_PARSER_READY && frame.command == 3U && frame.payload[0] == 0x55U;
}

static int packet_oversize_recovery(void)
{
  PacketParser parser;
  PacketFrame frame;
  PacketParser_Init(&parser);
  (void)PacketParser_Push(&parser, PACKET_SOF, 0U, &frame);
  if (PacketParser_Push(&parser, (uint8_t)(PACKET_MAX_PAYLOAD + 1U), 1U, &frame) != PACKET_PARSER_OVERSIZE) return 0;
  return push_valid(&parser, 2U, &frame) == PACKET_PARSER_READY && frame.command == 3U;
}

static int usart_generic_error(void)
{
  UsartRxState state;
  UsartRx_Init(&state);
  return UsartRx_OnError(&state, USART_RX_ERROR_OTHER) == USART_RX_ACTION_REARM && state.error_count == 1U && state.ore_count == 0U;
}

static int usart_queue_full(void)
{
  UsartRxState state;
  uint8_t byte = 0U;
  uint8_t index;
  UsartRx_Init(&state);
  for (index = 0U; index < (uint8_t)(USART_RX_CAPACITY - 1U); ++index) (void)UsartRx_OnByte(&state, index);
  (void)UsartRx_OnByte(&state, 0xEEU);
  return state.dropped_count == 1U && UsartRx_Pop(&state, &byte) && byte == 0U;
}

static int packet_sof_resync(void)
{
  PacketParser parser;
  PacketFrame frame;
  uint8_t payload[1] = {0x66U};
  uint8_t remainder[4] = {1U, 8U, 0x66U, 0U};
  uint8_t index;
  PacketParserResult result = PACKET_PARSER_NONE;
  remainder[3] = checksum(1U, 8U, payload);
  PacketParser_Init(&parser);
  (void)PacketParser_Push(&parser, PACKET_SOF, 0U, &frame);
  if (PacketParser_Push(&parser, PACKET_SOF, 1U, &frame) != PACKET_PARSER_OVERSIZE) return 0;
  for (index = 0U; index < 4U; ++index) result = PacketParser_Push(&parser, remainder[index], 2U + index, &frame);
  return result == PACKET_PARSER_READY && frame.command == 8U && frame.payload[0] == 0x66U;
}

#ifdef HOST_ST_FREESTANDING
unsigned int mainCRTStartup(void)
#else
int main(void)
#endif
{
  int passed = 0;
  switch (TEST_CASE) {
    case 1: passed = dma_first_frame(); break;
    case 2: passed = dma_source_changes(); break;
    case 3: passed = usart_rearm(); break;
    case 4: passed = usart_ore(); break;
    case 5: passed = packet_partial(); break;
    case 6: passed = packet_concat(); break;
    case 7: passed = packet_bad_checksum(); break;
    case 8: passed = packet_timeout(); break;
    case 9: passed = packet_oversize(); break;
    case 10: passed = mpu_addresses(); break;
    case 11: passed = mpu_classification(); break;
    case 12: passed = packet_drop_recovery(); break;
    case 13: passed = packet_oversize_recovery(); break;
    case 14: passed = usart_generic_error(); break;
    case 15: passed = usart_queue_full(); break;
    case 16: passed = packet_sof_resync(); break;
    default: passed = 0; break;
  }
  return passed ? 0U : 1U;
}
