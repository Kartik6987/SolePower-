/*
  SOLEPOWER - ESP32 38-pin LIVE FOOTSTEP DEMO
  Hardware already installed:
    GPIO25 -> 330 ohm -> Red LED anode; LED cathode -> GND
    GPIO27 -> foil contact #1; foil contact #2 -> GND
    USB cable -> ESP32 power

  IMPORTANT:
    There is NO INA219 requirement and NO FAKE telemetry.
    STEP count is incremented ONLY by the foil switch.
    Voltage stays UNSUPPORTED until voltage sensor is safely installed.
    NO direct piezo-to-ESP32 GPIO connection.
*/

#include <WiFi.h>
#include <HTTPClient.h>

// ======= CHANGE THESE THREE VALUES =======
const char* WIFI_SSID = "KADDU";
const char* WIFI_PASSWORD = "17DECEMBER";
// IPv4 of the laptop running SOLEPOWER (run ipconfig on Windows)
const char* LAPTOP_IP = "192.168.100.67";
// =========================================

const char* DEVICE_UID = "SOLEPOWER-01";
const uint16_t SERVER_PORT = 8000;
const int LED_PIN = 25;
const int FOIL_PIN = 27;
const int VOLTAGE_PIN = 34;

// Keep false for today's LED + foil demo.
// Change to true ONLY AFTER the piezo-to-GPIO34 measurement circuit,
// input clamping, and polarity have been independently verified.
const bool ENABLE_VOLTAGE_SENSOR = true;
const float VOLTAGE_DIVIDER_RATIO = 2.0f; // two 100k resistors; 100k/100k

unsigned long steps = 0;
bool lastRaw = HIGH;
bool stableState = HIGH;
unsigned long changedAt = 0;
unsigned long lastStepAt = 0;
unsigned long ledOnAt = 0;
bool ledOn = false;
bool pendingSend = true;
unsigned long lastSendAt = 0;
unsigned long lastWiFiAttempt = 0;
const unsigned long DEBOUNCE_MS = 45;
const unsigned long COOLDOWN_MS = 250;
const unsigned long LED_FLASH_MS = 200;
const unsigned long TELEMETRY_MS = 1200;

float getStoredVoltage() {
  if (!ENABLE_VOLTAGE_SENSOR) return 0.0f;
  float totalMv = 0;
  for (int i = 0; i < 12; i++) {
    totalMv += analogReadMilliVolts(VOLTAGE_PIN);
  }
  float voltage = (totalMv / 12.0f) / 1000.0f * VOLTAGE_DIVIDER_RATIO;
  if (voltage < 0.06f) voltage = 0.0f;
  return voltage;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  unsigned long beginAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - beginAt < 12000) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("Sending to http://");
    Serial.print(LAPTOP_IP);
    Serial.println(":8000/api/readings");
  } else {
    Serial.println("Wi-Fi not connected. Check name/password and 2.4GHz support.");
  }
}

void detectFootstep(unsigned long now) {
  bool raw = digitalRead(FOIL_PIN);
  if (raw != lastRaw) {
    lastRaw = raw;
    changedAt = now;
  }
  if (now - changedAt >= DEBOUNCE_MS && raw != stableState) {
    stableState = raw;
    if (stableState == LOW &&
        (steps == 0 || now - lastStepAt >= COOLDOWN_MS)) {
      steps++;
      lastStepAt = now;
      digitalWrite(LED_PIN, HIGH);
      ledOnAt = now;
      ledOn = true;
      pendingSend = true;
      Serial.print("FOIL STEP DETECTED! Steps: ");
      Serial.println(steps);
    }
  }
  if (ledOn && now - ledOnAt >= LED_FLASH_MS) {
    digitalWrite(LED_PIN, LOW);
    ledOn = false;
  }
}

void postReading() {
  if (WiFi.status() != WL_CONNECTED) return;
  WiFiClient client;
  HTTPClient http;
  String url = String("http://") + LAPTOP_IP + ":" + String(SERVER_PORT) + "/api/readings";
  http.setTimeout(1500);
  if (!http.begin(client, url)) {
    Serial.println("Could not open HTTP connection.");
    return;
  }
  http.addHeader("Content-Type", "application/json");
  float measuredStoredVoltage = getStoredVoltage();
  String payload = String("{\"device_uid\":\"") + DEVICE_UID + "\","
    + "\"steps\":" + String(steps)
    + ",\"voltage\":" + String(measuredStoredVoltage,3)
    + ",\"battery_voltage\":" + String(measuredStoredVoltage,3)
    + ",\"current_ma\":0.0"
    + ",\"voltage_sensor_enabled\":" + String(ENABLE_VOLTAGE_SENSOR ? "true" : "false")
    + "}";
  int response = http.POST(payload);
  if (response == 201) {
    Serial.print("SENT OK | Steps: ");
    Serial.print(steps);
    if (ENABLE_VOLTAGE_SENSOR) {
      Serial.print(" | Stored Voltage: ");
      Serial.print(measuredStoredVoltage, 2);
      Serial.print(" V");
    } else {
      Serial.print(" | Voltage sensor not connected");
    }
    Serial.println();
    pendingSend = false;
  } else {
    Serial.print("HTTP POST failed (code ");
    Serial.print(response);
    Serial.println("). Check laptop IP, port 8000, WiFi and firewall.");
    pendingSend = true;
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  pinMode(FOIL_PIN, INPUT_PULLUP);
  analogReadResolution(12);
  analogSetPinAttenuation(VOLTAGE_PIN, ADC_11db);
  delay(600);
  Serial.println("SOLEPOWER REAL HARDWARE DEMO");
  Serial.println("GPIO25 LED | GPIO27 foil switch");
  connectWiFi();
}

void loop() {
  unsigned long now = millis();
  detectFootstep(now);

  if (WiFi.status() != WL_CONNECTED) {
    if (now - lastWiFiAttempt >= 5000) {
      lastWiFiAttempt = now;
      WiFi.reconnect();
    }
  } else if ((pendingSend && now - lastSendAt >= 250) ||
             now - lastSendAt >= TELEMETRY_MS) {
    lastSendAt = now;
    postReading();
  }
  delay(2);
}
