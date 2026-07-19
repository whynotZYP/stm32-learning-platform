#ifndef DISPLAY_H
#define DISPLAY_H
#include <stdint.h>
void Display_Init(void);
void Display_Clear(void);
void Display_WriteLine(uint8_t line, const char *text);
void Display_Refresh(void);
#endif
