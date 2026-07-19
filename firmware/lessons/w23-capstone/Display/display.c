#include "display.h"

void Display_Init(DisplayState *state) { state->render_count = 0U; }
void Display_Commit(DisplayState *state, const SensorSnapshot *snapshot, uint32_t timestamp_utc)
{
  (void)snapshot;
  (void)timestamp_utc;
  ++state->render_count;
}
