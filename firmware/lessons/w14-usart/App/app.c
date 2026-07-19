#include "app.h"

#include "usart.h"
#include "usart_rx.h"

enum { USART_TX_TIMEOUT_MS = 20U };

static UsartRxState rx_state;
static uint8_t rx_byte;
static uint32_t rearm_failure_count;

static void rearm_receive(void)
{
  if (HAL_UART_Receive_IT(&huart1, &rx_byte, 1U) != HAL_OK) rearm_failure_count = rearm_failure_count + 1U;
}

void App_Init(void)
{
  static const uint8_t greeting[] = "USART1 115200 8N1 ready\r\n";
  UsartRx_Init(&rx_state);
  rearm_failure_count = 0U;
  (void)HAL_UART_Transmit(&huart1, (uint8_t *)greeting, sizeof(greeting) - 1U, 20U);
  rearm_receive();
}

void App_Run(void)
{
  uint8_t byte;
  if (UsartRx_Pop(&rx_state, &byte)) (void)HAL_UART_Transmit(&huart1, &byte, 1U, USART_TX_TIMEOUT_MS);
}

void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart)
{
  if (huart->Instance != USART1) return;
  (void)UsartRx_OnByte(&rx_state, rx_byte);
  rearm_receive();
}

void HAL_UART_ErrorCallback(UART_HandleTypeDef *huart)
{
  UsartRxError error;
  UsartRxAction action;
  if (huart->Instance != USART1) return;
  error = (huart->ErrorCode & HAL_UART_ERROR_ORE) != 0U ? USART_RX_ERROR_ORE : USART_RX_ERROR_OTHER;
  action = UsartRx_OnError(&rx_state, error);
  if ((action & USART_RX_ACTION_CLEAR_ORE) != 0U) __HAL_UART_CLEAR_OREFLAG(huart);
  rearm_receive();
}

uint32_t App_GetRxErrorCount(void)
{
  return rx_state.error_count;
}

uint32_t App_GetRxOverrunCount(void)
{
  return rx_state.ore_count;
}

uint32_t App_GetRxRearmFailureCount(void)
{
  return rearm_failure_count;
}
