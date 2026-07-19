#ifndef DEVICE_TESTS_H
#define DEVICE_TESTS_H

#include <stddef.h>

size_t DeviceTests_Count(void);
const char *DeviceTests_IdAt(size_t index);
int DeviceTests_IsKnown(const char *test_id);

#endif
