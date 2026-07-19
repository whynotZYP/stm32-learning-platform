#include "usart_rx.h"

void UsartRx_Init(UsartRxState *state)
{
  state->head = 0U;
  state->tail = 0U;
  state->error_count = 0U;
  state->ore_count = 0U;
  state->dropped_count = 0U;
}

UsartRxAction UsartRx_OnByte(UsartRxState *state, uint8_t byte)
{
  uint8_t next = (uint8_t)((state->head + 1U) % USART_RX_CAPACITY);
  if (next == state->tail) {
    state->dropped_count = state->dropped_count + 1U;
  } else {
    state->bytes[state->head] = byte;
    state->head = next;
  }
  return USART_RX_ACTION_REARM;
}

UsartRxAction UsartRx_OnError(UsartRxState *state, UsartRxError error)
{
  state->error_count = state->error_count + 1U;
  if (error == USART_RX_ERROR_ORE) {
    state->ore_count = state->ore_count + 1U;
    return (UsartRxAction)(USART_RX_ACTION_CLEAR_ORE | USART_RX_ACTION_REARM);
  }
  return USART_RX_ACTION_REARM;
}

bool UsartRx_Pop(UsartRxState *state, uint8_t *byte)
{
  if (state->tail == state->head) return false;
  *byte = state->bytes[state->tail];
  state->tail = (uint8_t)((state->tail + 1U) % USART_RX_CAPACITY);
  return true;
}
