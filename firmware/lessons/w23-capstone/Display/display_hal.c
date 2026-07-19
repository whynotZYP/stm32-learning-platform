#include "display_hal.h"

#include <stdio.h>
#include "usart.h"

int DisplayHal_Render(void *context, const SensorSnapshot *snapshot, uint32_t timestamp_utc)
{
  char health_line[96];
  int length;
  (void)context;
  length = snprintf(health_line, sizeof(health_line),
                    "UTC=%lu light=%u temp=%u motion=%d,%d,%d\r\n",
                    (unsigned long)timestamp_utc, snapshot->light_raw, snapshot->temperature_raw,
                    snapshot->motion_x, snapshot->motion_y, snapshot->motion_z);
  if ((length <= 0) || ((size_t)length >= sizeof(health_line))) return -1;
  return (HAL_UART_Transmit(&huart1, (uint8_t *)health_line, (uint16_t)length, 50U) == HAL_OK) ? 0 : -1;
}
