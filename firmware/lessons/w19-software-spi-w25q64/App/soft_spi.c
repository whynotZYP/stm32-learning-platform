#include "soft_spi.h"

void SoftSpi_Init(SoftSpiIo *io)
{
  io->set_cs(io->context, 1U);
  io->set_sck(io->context, 0U);
  io->set_mosi(io->context, 0U);
}

void SoftSpi_Select(SoftSpiIo *io)
{
  io->set_sck(io->context, 0U);
  io->set_cs(io->context, 0U);
}

uint8_t SoftSpi_TransferByte(SoftSpiIo *io, uint8_t outgoing)
{
  uint8_t incoming = 0U;
  for (uint8_t mask = 0x80U; mask != 0U; mask >>= 1U) {
    io->set_mosi(io->context, (outgoing & mask) != 0U);
    io->set_sck(io->context, 1U);
    incoming = (uint8_t)((incoming << 1U) | (io->read_miso(io->context) ? 1U : 0U));
    io->set_sck(io->context, 0U);
  }
  return incoming;
}

void SoftSpi_Deselect(SoftSpiIo *io)
{
  io->set_sck(io->context, 0U);
  io->set_cs(io->context, 1U);
}
