#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>

/* ========= WIFI ========= */
const char* ssid = "jazz";
const char* password = "abcdefg123";

/* ========= CAMERA PINS (AI THINKER) ========= */
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

WebServer server(80);

/* ========= STREAM HANDLER ========= */
void handleStream() {
  WiFiClient client = server.client();

  client.println(
    "HTTP/1.1 200 OK\r\n"
    "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n\r\n"
  );

  while (client.connected()) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) continue;

    client.printf(
      "--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n",
      fb->len
    );
    client.write(fb->buf, fb->len);
    client.println();

    esp_camera_fb_return(fb);
    // delay(30);
    delay(100);  // ~10 FPS (lebih smooth & stabil)
  }
}

/* ========= ROOT ========= */
void handleRoot() {
  server.send(200, "text/plain",
    "ESP32-CAM READY\n\n"
    "Stream at:\n"
    "/stream\n"
  );
}

/* ========= SETUP ========= */
void setup() {
  Serial.begin(115200);
  Serial.println("\nBooting ESP32-CAM...");

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;

  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  // config.frame_size   = FRAMESIZE_QVGA;
  // config.jpeg_quality = 12;
  // config.fb_count     = 2;
  config.frame_size   = FRAMESIZE_QQVGA; // 160x120
  config.jpeg_quality = 15;              // lebih kecil size
  config.fb_count     = 1;               // penting!

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x", err);
    return;
  }

  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected!");
  Serial.print("Camera Stream URL: http://");
  Serial.print(WiFi.localIP());
  Serial.println("/stream");

  server.on("/", handleRoot);
  server.on("/stream", HTTP_GET, handleStream);
  server.begin();
}

/* ========= LOOP ========= */
void loop() {
  server.handleClient();
}
