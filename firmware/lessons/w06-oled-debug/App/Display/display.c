#include "display.h"
#include <string.h>
static char lines[3][20];
void Display_Init(void) { Display_Clear(); }
void Display_Clear(void) { memset(lines, 0, sizeof lines); }
void Display_WriteLine(uint8_t line, const char *text) { if (line < 3U) { (void)strncpy(lines[line], text, sizeof lines[line] - 1U); } }
void Display_Refresh(void) { /* Software I2C transfer belongs here; PB6/PB7 are open-drain with 3.3 V pull-ups. */ }
