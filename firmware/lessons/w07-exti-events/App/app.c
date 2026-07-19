#include "app.h"
#include "main.h"
static volatile uint32_t ir_events;
static volatile int32_t encoder_events;
void App_Init(void) { ir_events = 0U; encoder_events = 0U; }
void App_OnIrEvent(void) { ++ir_events; }
void App_OnEncoderEvent(GPIO_PinState encoder_b) { encoder_events += encoder_b == GPIO_PIN_SET ? 1 : -1; }
void App_Run(void) { (void)ir_events; (void)encoder_events; }
int32_t App_EncoderCount(void) { return encoder_events; }
