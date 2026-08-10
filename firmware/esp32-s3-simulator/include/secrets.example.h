#pragma once

namespace Provisioning {

static constexpr char WIFI_SSID[] = "REPLACE_WITH_WIFI_SSID";
static constexpr char WIFI_PASSWORD[] = "REPLACE_WITH_WIFI_PASSWORD";

// Use the laptop LAN address, not localhost. Do not include a trailing slash.
static constexpr char BASE_URL[] = "http://192.168.1.10:3000";
static constexpr char DEVICE_CODE[] = "REPLACE_WITH_REGISTERED_DEVICE_CODE";
static constexpr char LINE_CODE[] = "REPLACE_WITH_REGISTERED_LINE_CODE";
static constexpr char DEVICE_SECRET[] = "REPLACE_WITH_ONE_TIME_DEVICE_SECRET";

}  // namespace Provisioning
