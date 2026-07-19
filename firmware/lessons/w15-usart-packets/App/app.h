#ifndef APP_H
#define APP_H

#include "packet_parser.h"

void App_Init(void);
void App_Run(void);
PacketParserResult App_GetLastParserResult(void);
uint32_t App_GetRxRearmFailureCount(void);

#endif
