#include "display.h"
#include "main.h"

#include <stdbool.h>
#include <stddef.h>
#include <string.h>

static const uint8_t SSD1306_ADDRESS = 0x3CU;
static const uint8_t SSD1306_CONTROL_COMMAND = 0x00U;
static const uint8_t SSD1306_CONTROL_DATA = 0x40U;

static uint8_t framebuffer[1024U];
static volatile bool display_bus_ok;

typedef struct {
  char character;
  uint8_t columns[5];
} Glyph;

/* The lesson only needs the characters used by Count, Input, HIGH, LOW and Diag. */
static const Glyph font[] = {
  {' ', {0x00U, 0x00U, 0x00U, 0x00U, 0x00U}},
  {':', {0x00U, 0x36U, 0x36U, 0x00U, 0x00U}},
  {'?', {0x02U, 0x01U, 0x51U, 0x09U, 0x06U}},
  {'0', {0x3EU, 0x51U, 0x49U, 0x45U, 0x3EU}},
  {'1', {0x00U, 0x42U, 0x7FU, 0x40U, 0x00U}},
  {'2', {0x42U, 0x61U, 0x51U, 0x49U, 0x46U}},
  {'3', {0x21U, 0x41U, 0x45U, 0x4BU, 0x31U}},
  {'4', {0x18U, 0x14U, 0x12U, 0x7FU, 0x10U}},
  {'5', {0x27U, 0x45U, 0x45U, 0x45U, 0x39U}},
  {'6', {0x3CU, 0x4AU, 0x49U, 0x49U, 0x30U}},
  {'7', {0x01U, 0x71U, 0x09U, 0x05U, 0x03U}},
  {'8', {0x36U, 0x49U, 0x49U, 0x49U, 0x36U}},
  {'9', {0x06U, 0x49U, 0x49U, 0x29U, 0x1EU}},
  {'C', {0x3EU, 0x41U, 0x41U, 0x41U, 0x22U}},
  {'D', {0x7FU, 0x41U, 0x41U, 0x22U, 0x1CU}},
  {'G', {0x3EU, 0x41U, 0x49U, 0x49U, 0x7AU}},
  {'H', {0x7FU, 0x08U, 0x08U, 0x08U, 0x7FU}},
  {'I', {0x00U, 0x41U, 0x7FU, 0x41U, 0x00U}},
  {'L', {0x7FU, 0x40U, 0x40U, 0x40U, 0x40U}},
  {'O', {0x3EU, 0x41U, 0x41U, 0x41U, 0x3EU}},
  {'W', {0x3FU, 0x40U, 0x38U, 0x40U, 0x3FU}},
  {'a', {0x20U, 0x54U, 0x54U, 0x54U, 0x78U}},
  {'g', {0x0CU, 0x52U, 0x52U, 0x52U, 0x3EU}},
  {'i', {0x00U, 0x44U, 0x7DU, 0x40U, 0x00U}},
  {'n', {0x7CU, 0x08U, 0x04U, 0x04U, 0x78U}},
  {'o', {0x38U, 0x44U, 0x44U, 0x44U, 0x38U}},
  {'p', {0x7CU, 0x14U, 0x14U, 0x14U, 0x08U}},
  {'t', {0x04U, 0x3FU, 0x44U, 0x40U, 0x20U}},
  {'u', {0x3CU, 0x40U, 0x40U, 0x20U, 0x7CU}},
};

static void i2c_delay(void) {
  for (volatile uint32_t cycle = 0U; cycle < 12U; ++cycle) {
    __NOP();
  }
}

static void scl_write(bool high) {
  HAL_GPIO_WritePin(OLED_SCL_GPIO_Port, OLED_SCL_Pin,
                    high ? GPIO_PIN_SET : GPIO_PIN_RESET);
}

static void sda_write(bool high) {
  HAL_GPIO_WritePin(OLED_SDA_GPIO_Port, OLED_SDA_Pin,
                    high ? GPIO_PIN_SET : GPIO_PIN_RESET);
}

static void i2c_start(void) {
  sda_write(true);
  scl_write(true);
  i2c_delay();
  sda_write(false);
  i2c_delay();
  scl_write(false);
}

static void i2c_stop(void) {
  sda_write(false);
  i2c_delay();
  scl_write(true);
  i2c_delay();
  sda_write(true);
  i2c_delay();
}

static bool i2c_write_byte(uint8_t value) {
  for (uint8_t bit = 0U; bit < 8U; ++bit) {
    scl_write(false);
    sda_write((value & 0x80U) != 0U);
    i2c_delay();
    scl_write(true);
    i2c_delay();
    value <<= 1U;
  }

  scl_write(false);
  sda_write(true);
  i2c_delay();
  scl_write(true);
  i2c_delay();
  const bool acknowledged =
      HAL_GPIO_ReadPin(OLED_SDA_GPIO_Port, OLED_SDA_Pin) == GPIO_PIN_RESET;
  scl_write(false);
  i2c_delay();
  return acknowledged;
}

static bool i2c_begin(uint8_t control) {
  i2c_start();
  if (!i2c_write_byte((uint8_t)(SSD1306_ADDRESS << 1U)) ||
      !i2c_write_byte(control)) {
    i2c_stop();
    return false;
  }
  return true;
}

static bool ssd1306_write_commands(const uint8_t *commands, size_t count) {
  if (!i2c_begin(SSD1306_CONTROL_COMMAND)) {
    return false;
  }
  for (size_t index = 0U; index < count; ++index) {
    if (!i2c_write_byte(commands[index])) {
      i2c_stop();
      return false;
    }
  }
  i2c_stop();
  return true;
}

static const uint8_t *glyph_for(char character) {
  for (size_t index = 0U; index < (sizeof font / sizeof font[0]); ++index) {
    if (font[index].character == character) {
      return font[index].columns;
    }
  }
  return font[2].columns;
}

void Display_Init(void) {
  static const uint8_t init_commands[] = {
    0xAEU, 0xD5U, 0x80U, 0xA8U, 0x3FU, 0xD3U, 0x00U, 0x40U,
    0x20U, 0x02U,
    0x8DU, 0x14U, 0xA1U, 0xC8U, 0xDAU, 0x12U, 0x81U, 0x7FU,
    0xD9U, 0xF1U, 0xDBU, 0x40U, 0xA4U, 0xA6U, 0xAFU,
  };

  scl_write(true);
  sda_write(true);
  HAL_Delay(100U);
  Display_Clear();
  display_bus_ok =
      ssd1306_write_commands(init_commands, sizeof init_commands);
  if (display_bus_ok) {
    Display_Refresh();
  }
}

void Display_Clear(void) {
  memset(framebuffer, 0, sizeof framebuffer);
}

void Display_WriteLine(uint8_t line, const char *text) {
  if ((line >= 8U) || (text == NULL)) {
    return;
  }

  uint8_t *row = &framebuffer[(size_t)line * 128U];
  memset(row, 0, 128U);
  uint8_t column = 0U;
  while ((*text != '\0') && (column <= 122U)) {
    const uint8_t *glyph = glyph_for(*text++);
    for (uint8_t glyph_column = 0U; glyph_column < 5U; ++glyph_column) {
      row[column++] = glyph[glyph_column];
    }
    row[column++] = 0x00U;
  }
}

void Display_Refresh(void) {
  if (!display_bus_ok) {
    return;
  }

  for (uint8_t page = 0U; page < 8U; ++page) {
    const uint8_t page_commands[] = {
      (uint8_t)(0xB0U | page), 0x00U, 0x10U,
    };
    if (!ssd1306_write_commands(page_commands, sizeof page_commands) ||
        !i2c_begin(SSD1306_CONTROL_DATA)) {
      display_bus_ok = false;
      return;
    }

    for (uint8_t column = 0U; column < 128U; ++column) {
      if (!i2c_write_byte(framebuffer[((size_t)page * 128U) + column])) {
        i2c_stop();
        display_bus_ok = false;
        return;
      }
    }
    i2c_stop();
  }
}
