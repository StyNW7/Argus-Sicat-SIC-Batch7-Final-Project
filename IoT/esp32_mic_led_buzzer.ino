#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "driver/i2s.h"

/* ================= WIFI ================= */
#define WIFI_SSID "jazz"
#define WIFI_PASS "abcdefg123"

/* ================= MQTT (HiveMQ Cloud) ================= */
#define MQTT_BROKER "356baf144d204fa38e088e5d482823e7.s1.eu.hivemq.cloud"
#define MQTT_PORT   8883
#define MQTT_USER   "sicat"
#define MQTT_PASS   "Sicat7sic"
#define DEVICE_ID   "esp32_audio_01"

/* ================= TOPICS ================= */
#define TOPIC_AUDIO   "iot/audio/chunk"
#define TOPIC_RESULT  "iot/integrity/result"

/* ================= LED & BUZZER ================= */
#define LED_GREEN   26
#define LED_YELLOW  27
#define LED_RED     25
#define BUZZER      33

/* ================= I2S MIC ================= */
#define I2S_WS   15
#define I2S_SD   32
#define I2S_SCK  14

#define SAMPLE_RATE 16000
#define CHUNK_SIZE  64   // kecil & aman

WiFiClientSecure secureClient;
PubSubClient mqtt(secureClient);

int16_t audioBuffer[CHUNK_SIZE];
uint32_t seq = 0;

/* ================= MQTT CALLBACK ================= */
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<128> doc;
  if (deserializeJson(doc, payload, length)) return;

  float score = doc["integrity_score"];
  const char* label = doc["label"];

  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED, LOW);
  digitalWrite(BUZZER, LOW);

  if (strcmp(label, "green") == 0) {
    digitalWrite(LED_GREEN, HIGH);
  }
  else if (strcmp(label, "yellow") == 0) {
    digitalWrite(LED_YELLOW, HIGH);
  }
  else if (strcmp(label, "red") == 0) {
    digitalWrite(LED_RED, HIGH);
    tone(BUZZER, 2000);
    delay(1000);
    noTone(BUZZER);
  }

  Serial.printf("[AI] Score: %.2f | Label: %s\n", score, label);
}

/* ================= MQTT CONNECT ================= */
void connectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("[MQTT] Connecting...");
    if (mqtt.connect(DEVICE_ID, MQTT_USER, MQTT_PASS)) {
      Serial.println("connected");
      mqtt.subscribe(TOPIC_RESULT);
    } else {
      Serial.print("failed rc=");
      Serial.println(mqtt.state());
      delay(2000);
    }
  }
}

/* ================= SETUP ================= */
void setup() {
  Serial.begin(115200);

  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER, OUTPUT);

  /* ---- WiFi ---- */
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[WiFi] Connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" connected");

  /* ---- MQTT ---- */
  secureClient.setInsecure();  // penting untuk HiveMQ
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  connectMQTT();

  /* ---- I2S ---- */
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = 128,
    .use_apll = false
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_SCK,
    .ws_io_num = I2S_WS,
    .data_out_num = -1,
    .data_in_num = I2S_SD
  };

  i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pin_config);

  Serial.println("[SYSTEM] Ready");
}

/* ================= LOOP ================= */
void loop() {
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();

  size_t bytesRead;
  i2s_read(I2S_NUM_0, audioBuffer, sizeof(audioBuffer), &bytesRead, portMAX_DELAY);

  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["seq"] = seq++;

  JsonArray audio = doc.createNestedArray("audio");
  for (int i = 0; i < CHUNK_SIZE; i++) {
    audio.add(audioBuffer[i]);
  }

  char payload[256];
  size_t len = serializeJson(doc, payload);

  mqtt.publish(TOPIC_AUDIO, payload, len);
  Serial.println("[MQTT] Audio chunk sent");

  delay(30); // aman & stabil
}
