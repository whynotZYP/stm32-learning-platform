#ifndef SOFT_SPI_H
#define SOFT_SPI_H

#include <stdint.h>

typedef struct {
  void *context;
  void (*set_cs)(void *context, uint8_t level);
  void (*set_sck)(void *context, uint8_t level);
  void (*set_mosi)(void *context, uint8_t level);
  uint8_t (*read_miso)(void *context);
} SoftSpiIo;

void SoftSpi_Init(SoftSpiIo *io);
void SoftSpi_Select(SoftSpiIo *io);
uint8_t SoftSpi_TransferByte(SoftSpiIo *io, uint8_t outgoing);
void SoftSpi_Deselect(SoftSpiIo *io);

#endif
