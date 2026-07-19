#ifndef USART_RX_H
#define USART_RX_H

#include <stdbool.h>
#include <stdint.h>

enum { USART_RX_CAPACITY = 64U };

typedef enum {
  USART_RX_ACTION_NONE = 0U,
  USART_RX_ACTION_REARM = 1U,
  USART_RX_ACTION_CLEAR_ORE = 2U
} UsartRxAction;

typedef enum {
  USART_RX_ERROR_OTHER = 0U,
  USART_RX_ERROR_ORE = 1U
} UsartRxError;

typedef struct {
  volatile uint8_t bytes[USART_RX_CAPACITY];
  volatile uint8_t head;
  volatile uint8_t tail;
  volatile uint32_t error_count;
  volatile uint32_t ore_count;
  volatile uint32_t dropped_count;
} UsartRxState;

void UsartRx_Init(UsartRxState *state);
UsartRxAction UsartRx_OnByte(UsartRxState *state, uint8_t byte);
UsartRxAction UsartRx_OnError(UsartRxState *state, UsartRxError error);
bool UsartRx_Pop(UsartRxState *state, uint8_t *byte);

#endif
