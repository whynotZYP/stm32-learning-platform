#include "app.h"

#include "usart.h"
#include "usart_rx.h"

enum { PACKET_TX_TIMEOUT_MS = 20U };

static UsartRxState rx_state;
static PacketParser parser;
static PacketFrame received_frame;
static PacketParserResult last_result;
static uint8_t rx_byte;
static uint32_t rearm_failure_count;

static void rearm_receive(void)
{
  if (HAL_UART_Receive_IT(&huart1, &rx_byte, 1U) != HAL_OK) rearm_failure_count = rearm_failure_count + 1U;
}

static void send_status(uint8_t status)
{
  (void)HAL_UART_Transmit(&huart1, &status, 1U, PACKET_TX_TIMEOUT_MS);
}

void App_Init(void)
{
  UsartRx_Init(&rx_state);
  PacketParser_Init(&parser);
  last_result = PACKET_PARSER_NONE;
  rearm_failure_count = 0U;
  rearm_receive();
}

void App_Run(void)
{
  uint8_t byte;
  PacketParserResult result = PacketParser_PollTimeout(&parser, HAL_GetTick());
  if (result != PACKET_PARSER_NONE) last_result = result;
  while (UsartRx_Pop(&rx_state, &byte)) {
    result = PacketParser_Push(&parser, byte, HAL_GetTick(), &received_frame);
    if (result == PACKET_PARSER_READY) {
      last_result = result;
      send_status(0x06U);
    } else if (result != PACKET_PARSER_NONE) {
      last_result = result;
      send_status(0x15U);
    }
  }
}

void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart)
{
  if (huart->Instance != USART1) return;
  (void)UsartRx_OnByte(&rx_state, rx_byte);
  rearm_receive();
}

void HAL_UART_ErrorCallback(UART_HandleTypeDef *huart)
{
  UsartRxAction action;
  UsartRxError error;
  if (huart->Instance != USART1) return;
  error = (huart->ErrorCode & HAL_UART_ERROR_ORE) != 0U ? USART_RX_ERROR_ORE : USART_RX_ERROR_OTHER;
  action = UsartRx_OnError(&rx_state, error);
  if ((action & USART_RX_ACTION_CLEAR_ORE) != 0U) __HAL_UART_CLEAR_OREFLAG(huart);
  rearm_receive();
}

PacketParserResult App_GetLastParserResult(void)
{
  return last_result;
}

uint32_t App_GetRxRearmFailureCount(void)
{
  return rearm_failure_count;
}
