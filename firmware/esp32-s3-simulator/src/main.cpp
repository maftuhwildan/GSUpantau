#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <esp_system.h>
#include <sys/time.h>
#include <time.h>

#include "secrets.h"

#ifndef FIRMWARE_GIT_REV
#define FIRMWARE_GIT_REV "unknown"
#endif

namespace {

constexpr char FIRMWARE_VERSION[] = "0.1.0-sim";
constexpr uint8_t BOOT_BUTTON_PIN = 0;
constexpr uint32_t SERIAL_BAUD = 115200;
constexpr uint32_t HTTP_TIMEOUT_MS = 5000;
constexpr uint32_t WIFI_CONNECT_TIMEOUT_MS = 15000;
constexpr uint32_t BUTTON_DEBOUNCE_MS = 50;
constexpr uint32_t CONFIG_REFRESH_MS = 5UL * 60UL * 1000UL;
constexpr uint32_t DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 10;
constexpr size_t DEFAULT_BATCH_SIZE = 100;
constexpr size_t HARD_BATCH_LIMIT = 100;
constexpr size_t EVENT_QUEUE_CAPACITY = 256;
constexpr uint32_t MAX_SEQUENCE = 2147483647UL;
constexpr size_t MAX_SERIAL_LINE_LENGTH = 128;

enum class EventMode { TEST, PRODUCTION };

struct EventRecord {
  String eventId;
  String bootId;
  String eventType;
  String deviceTime;
  String eventMode;
  String eventJson;
  uint32_t sequence = 0;
  uint32_t enqueuedAtMs = 0;
};

struct RetryBackoff {
  uint8_t failures = 0;
  uint32_t nextAttemptAtMs = 0;

  bool due(uint32_t now) const {
    return nextAttemptAtMs == 0 || static_cast<int32_t>(now - nextAttemptAtMs) >= 0;
  }

  void scheduleNow() {
    nextAttemptAtMs = 0;
  }

  void scheduleAfter(uint32_t now, uint32_t delayMs) {
    failures = 0;
    nextAttemptAtMs = now + delayMs;
  }

  uint32_t fail(uint32_t now) {
    const uint8_t exponent = failures > 5 ? 5 : failures;
    uint32_t baseDelay = 1000UL << exponent;
    if (baseDelay > 60000UL) {
      baseDelay = 60000UL;
    }
    const uint32_t jitter = esp_random() % (baseDelay / 5UL + 1UL);
    const uint32_t delayMs = baseDelay + jitter;
    if (failures < 6) {
      failures++;
    }
    nextAttemptAtMs = now + delayMs;
    return delayMs;
  }
};

EventRecord eventQueue[EVENT_QUEUE_CAPACITY];
size_t queueHead = 0;
size_t queueSize = 0;

String baseUrl;
String bootId;
uint32_t nextSequence = 0;
int64_t lastAckedSequence = -1;
EventMode currentMode = EventMode::TEST;

size_t configuredBatchSize = DEFAULT_BATCH_SIZE;
uint32_t heartbeatIntervalSeconds = DEFAULT_HEARTBEAT_INTERVAL_SECONDS;

bool provisioningValid = false;
bool configAttempted = false;
bool bootEventEnqueued = false;
bool readyForDetections = false;
bool networkEnabled = true;
bool heartbeatEnabled = true;
bool dropNextValidAck = false;
bool flowFault = false;
bool apiBlocked = false;
String faultReason;
uint32_t queueOverflowCount = 0;

String inFlightBody;
size_t inFlightCount = 0;

bool burstActive = false;
uint32_t burstRemaining = 0;
uint32_t burstIntervalMs = 0;
uint32_t nextBurstAtMs = 0;

String serialLine;
bool wifiWasConnected = false;
bool wifiConnectInProgress = false;
uint32_t wifiConnectStartedAtMs = 0;
bool lastButtonRaw = HIGH;
bool stableButtonState = HIGH;
uint32_t buttonChangedAtMs = 0;

RetryBackoff wifiRetry;
RetryBackoff configRetry;
RetryBackoff uploadRetry;
RetryBackoff heartbeatRetry;

bool timeReached(uint32_t now, uint32_t target) {
  return target == 0 || static_cast<int32_t>(now - target) >= 0;
}

const char* modeName(EventMode mode) {
  return mode == EventMode::PRODUCTION ? "PRODUCTION" : "TEST";
}

bool startsWithPlaceholder(const char* value) {
  return value == nullptr || value[0] == '\0' || String(value).startsWith("REPLACE_WITH_");
}

String trimTrailingSlashes(String value) {
  value.trim();
  while (value.endsWith("/")) {
    value.remove(value.length() - 1);
  }
  return value;
}

bool validateProvisioning() {
  if (startsWithPlaceholder(Provisioning::WIFI_SSID) ||
      startsWithPlaceholder(Provisioning::WIFI_PASSWORD) ||
      startsWithPlaceholder(Provisioning::DEVICE_CODE) ||
      startsWithPlaceholder(Provisioning::LINE_CODE) ||
      startsWithPlaceholder(Provisioning::DEVICE_SECRET)) {
    Serial.println("FAULT provisioning belum lengkap di include/secrets.h");
    return false;
  }

  baseUrl = trimTrailingSlashes(String(Provisioning::BASE_URL));
  if (!baseUrl.startsWith("http://")) {
    Serial.println("FAULT simulator LAN hanya menerima BASE_URL http://");
    return false;
  }
  if (strlen(Provisioning::DEVICE_CODE) > 50) {
    Serial.println("FAULT device code lebih dari 50 karakter");
    return false;
  }
  if (String(Provisioning::DEVICE_CODE).length() + 1 + 36 + 1 + 10 > 100) {
    Serial.println("FAULT format event_id dapat melewati 100 karakter");
    return false;
  }
  return true;
}

String makeUuidV4() {
  uint8_t bytes[16];
  esp_fill_random(bytes, sizeof(bytes));
  bytes[6] = (bytes[6] & 0x0F) | 0x40;
  bytes[8] = (bytes[8] & 0x3F) | 0x80;

  char output[37];
  snprintf(
      output,
      sizeof(output),
      "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
      bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
      bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]);
  return String(output);
}

bool clockIsValid() {
  time_t now = time(nullptr);
  return now >= 1704067200;  // 2024-01-01T00:00:00Z
}

int64_t daysFromCivil(int year, unsigned month, unsigned day) {
  year -= month <= 2;
  const int era = (year >= 0 ? year : year - 399) / 400;
  const unsigned yearOfEra = static_cast<unsigned>(year - era * 400);
  const unsigned adjustedMonth = month > 2 ? month - 3 : month + 9;
  const unsigned dayOfYear = (153 * adjustedMonth + 2) / 5 + day - 1;
  const unsigned dayOfEra = yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear;
  return static_cast<int64_t>(era) * 146097 + static_cast<int64_t>(dayOfEra) - 719468;
}

bool setClockFromServerTime(const char* isoTime) {
  if (isoTime == nullptr || strlen(isoTime) < 20 ||
      (isoTime[19] != '.' && isoTime[19] != 'Z')) {
    return false;
  }

  char secondsPart[20];
  memcpy(secondsPart, isoTime, 19);
  secondsPart[19] = '\0';

  struct tm parsed = {};
  if (strptime(secondsPart, "%Y-%m-%dT%H:%M:%S", &parsed) == nullptr) {
    return false;
  }

  const int year = parsed.tm_year + 1900;
  const unsigned month = static_cast<unsigned>(parsed.tm_mon + 1);
  const unsigned day = static_cast<unsigned>(parsed.tm_mday);
  const int64_t epochSeconds = daysFromCivil(year, month, day) * 86400LL +
      parsed.tm_hour * 3600LL + parsed.tm_min * 60LL + parsed.tm_sec;
  const time_t epoch = static_cast<time_t>(epochSeconds);
  if (epoch < 1704067200) {
    return false;
  }

  timeval tv = {epoch, 0};
  return settimeofday(&tv, nullptr) == 0;
}

String currentIsoTime() {
  timeval tv;
  gettimeofday(&tv, nullptr);
  struct tm utc;
  gmtime_r(&tv.tv_sec, &utc);

  char output[25];
  snprintf(
      output,
      sizeof(output),
      "%04d-%02d-%02dT%02d:%02d:%02d.%03ldZ",
      utc.tm_year + 1900,
      utc.tm_mon + 1,
      utc.tm_mday,
      utc.tm_hour,
      utc.tm_min,
      utc.tm_sec,
      tv.tv_usec / 1000L);
  return String(output);
}

EventRecord& queueAt(size_t offset) {
  return eventQueue[(queueHead + offset) % EVENT_QUEUE_CAPACITY];
}

void clearInFlight() {
  inFlightBody = String();
  inFlightCount = 0;
}

void popQueue(size_t count) {
  const size_t removable = count > queueSize ? queueSize : count;
  for (size_t index = 0; index < removable; index++) {
    eventQueue[queueHead] = EventRecord();
    queueHead = (queueHead + 1) % EVENT_QUEUE_CAPACITY;
    queueSize--;
  }
}

void enterFault(const String& reason, bool blockApi) {
  if (!flowFault) {
    Serial.print("FAULT ");
    Serial.println(reason);
  }
  flowFault = true;
  apiBlocked = apiBlocked || blockApi;
  faultReason = reason;
  burstActive = false;
  burstRemaining = 0;
}

bool enqueueEvent(const char* eventType) {
  if (!clockIsValid()) {
    enterFault("clock belum valid; event tidak dibuat", false);
    return false;
  }
  if (queueSize >= EVENT_QUEUE_CAPACITY) {
    queueOverflowCount++;
    enterFault("RAM queue penuh; flow dihentikan", false);
    return false;
  }
  if (nextSequence > MAX_SEQUENCE) {
    enterFault("sequence mencapai batas; lakukan controlled reboot", false);
    return false;
  }

  EventRecord record;
  record.bootId = bootId;
  record.sequence = nextSequence;
  record.eventType = eventType;
  record.deviceTime = currentIsoTime();
  record.eventMode = modeName(currentMode);
  record.eventId = String(Provisioning::DEVICE_CODE) + ":" + bootId + ":" + String(nextSequence);
  record.enqueuedAtMs = millis();

  JsonDocument eventDocument;
  eventDocument["event_id"] = record.eventId;
  eventDocument["boot_id"] = record.bootId;
  eventDocument["sequence"] = record.sequence;
  eventDocument["event_type"] = record.eventType;
  eventDocument["device_time"] = record.deviceTime;
  eventDocument["event_mode"] = record.eventMode;
  serializeJson(eventDocument, record.eventJson);

  const size_t tail = (queueHead + queueSize) % EVENT_QUEUE_CAPACITY;
  eventQueue[tail] = record;
  queueSize++;
  nextSequence++;

  Serial.printf(
      "ENQUEUE type=%s sequence=%lu mode=%s queue=%u/%u\n",
      eventType,
      static_cast<unsigned long>(record.sequence),
      record.eventMode.c_str(),
      static_cast<unsigned>(queueSize),
      static_cast<unsigned>(EVENT_QUEUE_CAPACITY));
  uploadRetry.scheduleNow();
  return true;
}

String jsonQuote(const String& value) {
  const char hex[] = "0123456789ABCDEF";
  String output = "\"";
  output.reserve(value.length() + 2);
  for (size_t index = 0; index < value.length(); index++) {
    const uint8_t character = static_cast<uint8_t>(value[index]);
    switch (character) {
      case '\"': output += "\\\""; break;
      case '\\': output += "\\\\"; break;
      case '\b': output += "\\b"; break;
      case '\f': output += "\\f"; break;
      case '\n': output += "\\n"; break;
      case '\r': output += "\\r"; break;
      case '\t': output += "\\t"; break;
      default:
        if (character < 0x20) {
          output += "\\u00";
          output += hex[character >> 4];
          output += hex[character & 0x0F];
        } else {
          output += static_cast<char>(character);
        }
    }
  }
  output += '\"';
  return output;
}

String urlEncode(const char* value) {
  const char hex[] = "0123456789ABCDEF";
  String output;
  for (const uint8_t* cursor = reinterpret_cast<const uint8_t*>(value); *cursor; cursor++) {
    const uint8_t character = *cursor;
    if ((character >= 'a' && character <= 'z') ||
        (character >= 'A' && character <= 'Z') ||
        (character >= '0' && character <= '9') ||
        character == '-' || character == '_' || character == '.' || character == '~') {
      output += static_cast<char>(character);
    } else {
      output += '%';
      output += hex[character >> 4];
      output += hex[character & 0x0F];
    }
  }
  return output;
}

int performGet(const String& path, String& responseBody) {
  HTTPClient http;
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  if (!http.begin(baseUrl + path)) {
    return -1;
  }
  http.addHeader("Authorization", String("Bearer ") + Provisioning::DEVICE_SECRET);
  const int status = http.GET();
  if (status > 0) {
    responseBody = http.getString();
  }
  http.end();
  return status;
}

int performPost(const String& path, const String& requestBody, String& responseBody) {
  HTTPClient http;
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  if (!http.begin(baseUrl + path)) {
    return -1;
  }
  http.addHeader("Authorization", String("Bearer ") + Provisioning::DEVICE_SECRET);
  http.addHeader("Content-Type", "application/json");
  const int status = http.POST(requestBody);
  if (status > 0) {
    responseBody = http.getString();
  }
  http.end();
  return status;
}

String responseErrorCode(const String& body) {
  JsonDocument document;
  if (deserializeJson(document, body) != DeserializationError::Ok) {
    return String();
  }
  return String(document["error"]["code"] | "");
}

bool handleTerminalHttpStatus(const char* endpoint, int status, const String& responseBody) {
  if (status != 400 && status != 401 && status != 404) {
    return false;
  }

  String reason = String(endpoint) + " ditolak HTTP " + String(status);
  const String code = responseErrorCode(responseBody);
  if (!code.isEmpty()) {
    reason += " ";
    reason += code;
  }
  enterFault(reason, true);
  return true;
}

bool fetchDeviceConfig(uint32_t now) {
  if (apiBlocked || WiFi.status() != WL_CONNECTED) {
    return false;
  }

  configAttempted = true;
  String body;
  const String path = String("/api/device/config?device_id=") +
      urlEncode(Provisioning::DEVICE_CODE) + "&line_id=" + urlEncode(Provisioning::LINE_CODE);
  const int status = performGet(path, body);

  if (status == 200) {
    JsonDocument document;
    const DeserializationError parseError = deserializeJson(document, body);
    const char* responseDevice = document["device_id"] | "";
    const char* responseLine = document["line_id"] | "";
    const int heartbeat = document["heartbeat_interval_seconds"] | 0;
    const int batch = document["batch_upload_max_events"] | 0;
    if (parseError == DeserializationError::Ok &&
        String(responseDevice) == Provisioning::DEVICE_CODE &&
        String(responseLine) == Provisioning::LINE_CODE &&
        heartbeat > 0 && batch > 0) {
      heartbeatIntervalSeconds = static_cast<uint32_t>(heartbeat);
      configuredBatchSize = static_cast<size_t>(batch) > HARD_BATCH_LIMIT
          ? HARD_BATCH_LIMIT
          : static_cast<size_t>(batch);
      setClockFromServerTime(document["server_time"] | "");
      configRetry.scheduleAfter(now, CONFIG_REFRESH_MS);
      Serial.printf(
          "CONFIG heartbeat=%lus batch=%u\n",
          static_cast<unsigned long>(heartbeatIntervalSeconds),
          static_cast<unsigned>(configuredBatchSize));
      return true;
    }
    Serial.println("CONFIG respons 200 tidak valid; akan retry");
  } else if (handleTerminalHttpStatus("config", status, body)) {
    return false;
  }

  const uint32_t retryIn = configRetry.fail(now);
  Serial.printf("CONFIG gagal status=%d retry=%lums\n", status, static_cast<unsigned long>(retryIn));
  return false;
}

void buildInFlightBatch() {
  if (inFlightCount > 0 || queueSize == 0) {
    return;
  }

  inFlightCount = queueSize < configuredBatchSize ? queueSize : configuredBatchSize;
  if (inFlightCount > HARD_BATCH_LIMIT) {
    inFlightCount = HARD_BATCH_LIMIT;
  }

  inFlightBody.reserve(96 + inFlightCount * 220);
  inFlightBody = "{\"device_id\":";
  inFlightBody += jsonQuote(String(Provisioning::DEVICE_CODE));
  inFlightBody += ",\"line_id\":";
  inFlightBody += jsonQuote(String(Provisioning::LINE_CODE));
  inFlightBody += ",\"events\":[";
  for (size_t index = 0; index < inFlightCount; index++) {
    if (index > 0) {
      inFlightBody += ',';
    }
    inFlightBody += queueAt(index).eventJson;
  }
  inFlightBody += "]}";
}

bool responseAcknowledgesInFlight(const String& body, int& accepted, int& duplicates) {
  JsonDocument document;
  if (deserializeJson(document, body) != DeserializationError::Ok) {
    return false;
  }

  JsonArray responseEvents = document["events"].as<JsonArray>();
  if (responseEvents.isNull() || responseEvents.size() != inFlightCount) {
    return false;
  }

  for (size_t queueIndex = 0; queueIndex < inFlightCount; queueIndex++) {
    const EventRecord& expected = queueAt(queueIndex);
    bool matched = false;
    for (JsonObject responseEvent : responseEvents) {
      const char* eventId = responseEvent["event_id"] | "";
      const char* responseBootId = responseEvent["boot_id"] | "";
      const uint32_t sequence = responseEvent["sequence"] | UINT32_MAX;
      const char* status = responseEvent["status"] | "";
      const bool successfulStatus = strcmp(status, "ACCEPTED") == 0 || strcmp(status, "DUPLICATE") == 0;
      if (expected.eventId == eventId && expected.bootId == responseBootId &&
          expected.sequence == sequence && successfulStatus) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      return false;
    }
  }

  accepted = document["accepted"] | 0;
  duplicates = document["duplicates"] | 0;
  return accepted >= 0 && duplicates >= 0 &&
      static_cast<size_t>(accepted + duplicates) == inFlightCount;
}

void serviceUpload(uint32_t now) {
  if (apiBlocked || queueSize == 0 || WiFi.status() != WL_CONNECTED || !uploadRetry.due(now)) {
    return;
  }

  buildInFlightBatch();
  if (inFlightCount == 0) {
    return;
  }

  String responseBody;
  const int status = performPost("/api/device/events", inFlightBody, responseBody);
  if (status == 200) {
    int accepted = 0;
    int duplicates = 0;
    if (responseAcknowledgesInFlight(responseBody, accepted, duplicates)) {
      if (dropNextValidAck) {
        dropNextValidAck = false;
        const uint32_t retryIn = uploadRetry.fail(now);
        Serial.printf(
            "DROP_ACK simulasi: batch tetap di queue dan retry identik dalam %lums\n",
            static_cast<unsigned long>(retryIn));
        return;
      }

      const uint32_t acknowledgedSequence = queueAt(inFlightCount - 1).sequence;
      const size_t acknowledgedCount = inFlightCount;
      popQueue(acknowledgedCount);
      lastAckedSequence = acknowledgedSequence;
      clearInFlight();
      uploadRetry.scheduleNow();
      Serial.printf(
          "ACK accepted=%d duplicate=%d last_sequence=%lu queue=%u\n",
          accepted,
          duplicates,
          static_cast<unsigned long>(acknowledgedSequence),
          static_cast<unsigned>(queueSize));
      return;
    }
    Serial.println("ACK respons 200 tidak cocok; queue dipertahankan");
  } else if (handleTerminalHttpStatus("events", status, responseBody)) {
    return;
  }

  const uint32_t retryIn = uploadRetry.fail(now);
  Serial.printf("UPLOAD gagal status=%d retry=%lums\n", status, static_cast<unsigned long>(retryIn));
}

String buildHeartbeatBody(uint32_t now) {
  JsonDocument document;
  document["device_id"] = Provisioning::DEVICE_CODE;
  document["line_id"] = Provisioning::LINE_CODE;
  document["firmware_version"] = FIRMWARE_VERSION;
  document["wifi_rssi"] = WiFi.RSSI();

  JsonObject diagnostic = document["diagnostic_payload"].to<JsonObject>();
  diagnostic["firmware_git_revision"] = FIRMWARE_GIT_REV;
  diagnostic["free_heap"] = ESP.getFreeHeap();
  diagnostic["uptime_seconds"] = millis() / 1000UL;
  diagnostic["queue_depth"] = queueSize;
  diagnostic["queue_capacity"] = EVENT_QUEUE_CAPACITY;
  diagnostic["oldest_event_age_ms"] = queueSize > 0 ? now - queueAt(0).enqueuedAtMs : 0;
  if (lastAckedSequence >= 0) {
    diagnostic["last_acked_sequence"] = lastAckedSequence;
  } else {
    diagnostic["last_acked_sequence"] = nullptr;
  }
  diagnostic["clock_synced"] = clockIsValid();
  diagnostic["sensor_fault"] = flowFault;
  diagnostic["queue_overflow_count"] = queueOverflowCount;
  diagnostic["network_simulated_offline"] = !networkEnabled;
  diagnostic["simulator_event_mode"] = modeName(currentMode);

  String body;
  serializeJson(document, body);
  return body;
}

void serviceHeartbeat(uint32_t now) {
  if (!heartbeatEnabled || apiBlocked || WiFi.status() != WL_CONNECTED || !heartbeatRetry.due(now)) {
    return;
  }

  String responseBody;
  const int status = performPost("/api/device/heartbeat", buildHeartbeatBody(now), responseBody);
  if (status == 200) {
    JsonDocument document;
    if (deserializeJson(document, responseBody) == DeserializationError::Ok &&
        String(document["status"] | "") == "OK") {
      heartbeatRetry.scheduleAfter(now, heartbeatIntervalSeconds * 1000UL);
      Serial.printf("HEARTBEAT OK status=%s\n", String(document["device_status"] | "UNKNOWN").c_str());
      return;
    }
    Serial.println("HEARTBEAT respons 200 tidak valid; akan retry");
  } else if (handleTerminalHttpStatus("heartbeat", status, responseBody)) {
    return;
  }

  const uint32_t retryIn = heartbeatRetry.fail(now);
  Serial.printf("HEARTBEAT gagal status=%d retry=%lums\n", status, static_cast<unsigned long>(retryIn));
}

void serviceWiFi(uint32_t now) {
  const bool connected = WiFi.status() == WL_CONNECTED;
  if (connected) {
    wifiConnectInProgress = false;
    if (!wifiWasConnected) {
      wifiWasConnected = true;
      wifiRetry.scheduleAfter(now, 0);
      configRetry.scheduleNow();
      uploadRetry.scheduleNow();
      heartbeatRetry.scheduleNow();
      Serial.printf("WIFI connected ip=%s rssi=%d\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    }
    return;
  }

  if (wifiWasConnected) {
    wifiWasConnected = false;
    wifiRetry.scheduleNow();
    Serial.println("WIFI disconnected");
  }
  if (!networkEnabled) {
    wifiConnectInProgress = false;
    return;
  }

  if (wifiConnectInProgress) {
    if (now - wifiConnectStartedAtMs < WIFI_CONNECT_TIMEOUT_MS) {
      return;
    }
    wifiConnectInProgress = false;
    WiFi.disconnect(false, false);
    const uint32_t retryIn = wifiRetry.fail(now);
    Serial.printf("WIFI timeout; retry dalam %lums\n", static_cast<unsigned long>(retryIn));
    return;
  }

  if (!wifiRetry.due(now)) {
    return;
  }

  WiFi.disconnect(false, false);
  WiFi.begin(Provisioning::WIFI_SSID, Provisioning::WIFI_PASSWORD);
  wifiConnectInProgress = true;
  wifiConnectStartedAtMs = now;
  Serial.printf("WIFI connecting; timeout=%lums\n", static_cast<unsigned long>(WIFI_CONNECT_TIMEOUT_MS));
}

void printStatus() {
  Serial.println("--- STATUS ---");
  Serial.printf("firmware=%s git=%s\n", FIRMWARE_VERSION, FIRMWARE_GIT_REV);
  Serial.printf("device=%s line=%s\n", Provisioning::DEVICE_CODE, Provisioning::LINE_CODE);
  Serial.printf("boot_id=%s next_sequence=%lu\n", bootId.c_str(), static_cast<unsigned long>(nextSequence));
  Serial.printf(
      "queue=%u/%u inflight=%u last_acked=%lld\n",
      static_cast<unsigned>(queueSize),
      static_cast<unsigned>(EVENT_QUEUE_CAPACITY),
      static_cast<unsigned>(inFlightCount),
      static_cast<long long>(lastAckedSequence));
  Serial.printf(
      "mode=%s ready=%s clock=%s heartbeat=%s network=%s\n",
      modeName(currentMode),
      readyForDetections ? "yes" : "no",
      clockIsValid() ? "synced" : "invalid",
      heartbeatEnabled ? "on" : "off",
      networkEnabled ? "on" : "off");
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("wifi=connected ip=%s rssi=%d\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println("wifi=disconnected");
  }
  Serial.printf("batch=%u heartbeat_interval=%lus\n", static_cast<unsigned>(configuredBatchSize), static_cast<unsigned long>(heartbeatIntervalSeconds));
  Serial.printf("fault=%s overflow=%lu\n", flowFault ? faultReason.c_str() : "none", static_cast<unsigned long>(queueOverflowCount));
  Serial.println("--------------");
}

void printHelp() {
  Serial.println("Perintah simulator:");
  Serial.println("  detect [jumlah]");
  Serial.println("  burst <jumlah> <interval_ms>");
  Serial.println("  mode test|production");
  Serial.println("  network on|off");
  Serial.println("  heartbeat on|off");
  Serial.println("  drop_ack once");
  Serial.println("  status");
  Serial.println("  reboot");
  Serial.println("  help");
}

bool parsePositiveNumber(const String& value, uint32_t& output) {
  if (value.isEmpty()) {
    return false;
  }
  for (size_t index = 0; index < value.length(); index++) {
    if (!isDigit(value[index])) {
      return false;
    }
  }
  const unsigned long parsed = strtoul(value.c_str(), nullptr, 10);
  if (parsed == 0) {
    return false;
  }
  output = static_cast<uint32_t>(parsed);
  return true;
}

void runDetectionCommand(uint32_t count) {
  if (!readyForDetections) {
    Serial.println("REJECT belum READY; tunggu config dan clock valid");
    return;
  }
  if (flowFault) {
    Serial.printf("REJECT firmware FAULT: %s\n", faultReason.c_str());
    return;
  }

  uint32_t created = 0;
  while (created < count && enqueueEvent("DETECTION")) {
    created++;
  }
  Serial.printf("DETECT requested=%lu created=%lu\n", static_cast<unsigned long>(count), static_cast<unsigned long>(created));
}

void handleCommand(String commandLine) {
  commandLine.trim();
  if (commandLine.isEmpty()) {
    return;
  }

  const int separator = commandLine.indexOf(' ');
  String command = separator < 0 ? commandLine : commandLine.substring(0, separator);
  String arguments = separator < 0 ? String() : commandLine.substring(separator + 1);
  command.toLowerCase();
  arguments.trim();

  if (command == "help") {
    printHelp();
    return;
  }
  if (command == "status") {
    printStatus();
    return;
  }
  if (command == "reboot") {
    Serial.println("Controlled reboot...");
    Serial.flush();
    ESP.restart();
    return;
  }
  if (command == "detect") {
    uint32_t count = 1;
    if (!arguments.isEmpty() && !parsePositiveNumber(arguments, count)) {
      Serial.println("ERROR format: detect [jumlah]");
      return;
    }
    runDetectionCommand(count);
    return;
  }
  if (command == "burst") {
    const int argumentSeparator = arguments.indexOf(' ');
    if (argumentSeparator < 0) {
      Serial.println("ERROR format: burst <jumlah> <interval_ms>");
      return;
    }
    String countText = arguments.substring(0, argumentSeparator);
    String intervalText = arguments.substring(argumentSeparator + 1);
    intervalText.trim();
    uint32_t count = 0;
    uint32_t interval = 0;
    if (!parsePositiveNumber(countText, count) || !parsePositiveNumber(intervalText, interval) || interval > 3600000UL) {
      Serial.println("ERROR jumlah/interval tidak valid");
      return;
    }
    if (!readyForDetections || flowFault) {
      Serial.println("REJECT firmware belum READY atau sedang FAULT");
      return;
    }
    burstRemaining = count;
    burstIntervalMs = interval;
    nextBurstAtMs = millis();
    burstActive = true;
    Serial.printf("BURST start count=%lu interval=%lums\n", static_cast<unsigned long>(count), static_cast<unsigned long>(interval));
    return;
  }
  if (command == "mode") {
    arguments.toLowerCase();
    if (arguments == "test") {
      currentMode = EventMode::TEST;
    } else if (arguments == "production") {
      currentMode = EventMode::PRODUCTION;
    } else {
      Serial.println("ERROR format: mode test|production");
      return;
    }
    Serial.printf("MODE %s untuk event berikutnya\n", modeName(currentMode));
    return;
  }
  if (command == "network") {
    arguments.toLowerCase();
    if (arguments == "off") {
      networkEnabled = false;
      wifiConnectInProgress = false;
      WiFi.disconnect(false, false);
      Serial.println("NETWORK simulasi offline; queue tetap menerima event");
    } else if (arguments == "on") {
      networkEnabled = true;
      wifiConnectInProgress = false;
      wifiRetry.scheduleNow();
      Serial.println("NETWORK reconnect diaktifkan");
    } else {
      Serial.println("ERROR format: network on|off");
    }
    return;
  }
  if (command == "heartbeat") {
    arguments.toLowerCase();
    if (arguments == "off") {
      heartbeatEnabled = false;
      Serial.println("HEARTBEAT dihentikan");
    } else if (arguments == "on") {
      heartbeatEnabled = true;
      heartbeatRetry.scheduleNow();
      Serial.println("HEARTBEAT diaktifkan");
    } else {
      Serial.println("ERROR format: heartbeat on|off");
    }
    return;
  }
  if (command == "drop_ack" && arguments == "once") {
    dropNextValidAck = true;
    Serial.println("DROP_ACK armed untuk ACK valid berikutnya");
    return;
  }

  Serial.println("ERROR perintah tidak dikenal; ketik help");
}

void serviceSerial() {
  while (Serial.available() > 0) {
    const char character = static_cast<char>(Serial.read());
    if (character == '\r') {
      continue;
    }
    if (character == '\n') {
      handleCommand(serialLine);
      serialLine = String();
      continue;
    }
    if (serialLine.length() < MAX_SERIAL_LINE_LENGTH) {
      serialLine += character;
    } else {
      serialLine = String();
      Serial.println("ERROR perintah terlalu panjang");
    }
  }
}

void serviceButton(uint32_t now) {
  const bool raw = digitalRead(BOOT_BUTTON_PIN);
  if (raw != lastButtonRaw) {
    lastButtonRaw = raw;
    buttonChangedAtMs = now;
  }
  if (raw != stableButtonState && now - buttonChangedAtMs >= BUTTON_DEBOUNCE_MS) {
    stableButtonState = raw;
    if (stableButtonState == LOW) {
      Serial.println("BUTTON detection trigger");
      runDetectionCommand(1);
    }
  }
}

void serviceBurst(uint32_t now) {
  if (!burstActive || flowFault || !readyForDetections) {
    return;
  }

  uint8_t generatedThisLoop = 0;
  while (burstRemaining > 0 && timeReached(now, nextBurstAtMs) && generatedThisLoop < 32) {
    if (!enqueueEvent("DETECTION")) {
      return;
    }
    burstRemaining--;
    generatedThisLoop++;
    nextBurstAtMs += burstIntervalMs;
  }
  if (burstRemaining == 0) {
    burstActive = false;
    Serial.println("BURST selesai");
  }
}

void serviceBootInitialization(uint32_t now) {
  if (bootEventEnqueued || apiBlocked || WiFi.status() != WL_CONNECTED) {
    return;
  }

  if (!configAttempted && configRetry.due(now)) {
    fetchDeviceConfig(now);
  }
  if (!configAttempted || !clockIsValid()) {
    return;
  }

  if (enqueueEvent("DEVICE_RESTART")) {
    bootEventEnqueued = true;
    readyForDetections = true;
    Serial.println("STATE READY; mode awal TEST");
  }
}

}  // namespace

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(1200);
  Serial.println();
  Serial.println("GSUpantau ESP32-S3 sensor simulator");

  pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);
  lastButtonRaw = digitalRead(BOOT_BUTTON_PIN);
  stableButtonState = lastButtonRaw;
  buttonChangedAtMs = millis();

  bootId = makeUuidV4();
  nextSequence = 0;
  queueHead = 0;
  queueSize = 0;
  clearInFlight();

  provisioningValid = validateProvisioning();
  Serial.printf("BOOT boot_id=%s sequence=0\n", bootId.c_str());
  printHelp();
  if (!provisioningValid) {
    enterFault("provisioning invalid", true);
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(false);
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  wifiRetry.scheduleNow();
  configRetry.scheduleNow();
}

void loop() {
  const uint32_t now = millis();
  serviceSerial();
  serviceButton(now);

  if (!provisioningValid) {
    delay(5);
    return;
  }

  serviceWiFi(now);
  serviceBootInitialization(now);
  serviceBurst(now);

  if (readyForDetections && !apiBlocked && configRetry.due(now)) {
    fetchDeviceConfig(now);
  }
  serviceUpload(now);
  serviceHeartbeat(now);
  delay(2);
}
