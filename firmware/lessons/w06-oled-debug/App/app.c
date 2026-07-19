#include "app.h"
#include "main.h"
#include "Display/display.h"
#include <stdio.h>

static uint32_t count;
void App_Init(void) { Display_Init(); Display_Clear(); }
void App_Run(void) { char line[20]; (void)snprintf(line, sizeof line, "Count:%lu", (unsigned long)count++); Display_WriteLine(0U, line); Display_WriteLine(1U, HAL_GPIO_ReadPin(DEBUG_INPUT_GPIO_Port, DEBUG_INPUT_Pin) == GPIO_PIN_SET ? "Input:HIGH" : "Input:LOW"); Display_WriteLine(2U, "Diag:D01"); Display_Refresh(); HAL_Delay(200U); }
