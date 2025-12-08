// esp32_audio_client.ino
#include <WiFi.h>
#include <HTTPClient.h>
#include <driver/i2s.h>
#include <base64.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// FastAPI server URL
const char* serverUrl = "http://YOUR_SERVER_IP:5000/upload";

// I2S Microphone Configuration (for INMP441)
#define I2S_WS 15   // Word Select (LRCLK)
#define I2S_SD 32   // Serial Data (DOUT)
#define I2S_SCK 14  // Serial Clock (BCLK)

// Audio settings
#define SAMPLE_RATE 16000
#define BUFFER_SIZE 1024
#define RECORD_SECONDS 3
#define I2S_PORT I2S_NUM_0

// Audio buffer
int16_t audioBuffer[BUFFER_SIZE * RECORD_SECONDS];
size_t bytesRead = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("Argus - ESP32 Audio Client");
  Serial.println("==========================");
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nConnected to WiFi!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  
  // Initialize I2S for microphone
  setupI2S();
  
  Serial.println("ESP32 Audio Client Ready!");
  Serial.println("Press the BOOT button to start recording...");
  
  // Setup button (using BOOT button on ESP32)
  pinMode(0, INPUT_PULLUP);
}

void loop() {
  // Check if button is pressed (BOOT button on ESP32)
  if (digitalRead(0) == LOW) {
    delay(50); // Debounce
    if (digitalRead(0) == LOW) {
      Serial.println("Button pressed! Recording audio...");
      
      // Record audio
      recordAudio();
      
      // Send to server
      sendAudioToServer();
      
      // Wait for button release
      while (digitalRead(0) == LOW) {
        delay(10);
      }
      delay(1000); // Cooldown between recordings
    }
  }
  
  // Auto-record every 10 seconds (for continuous monitoring)
  static unsigned long lastRecord = 0;
  if (millis() - lastRecord > 10000) {
    Serial.println("Auto-recording audio...");
    recordAudio();
    sendAudioToServer();
    lastRecord = millis();
  }
  
  delay(100);
}

void setupI2S() {
  Serial.println("Setting up I2S microphone...");
  
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = 1024,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };
  
  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_SCK,
    .ws_io_num = I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_SD
  };
  
  i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_PORT, &pin_config);
  i2s_set_clk(I2S_PORT, SAMPLE_RATE, I2S_BITS_PER_SAMPLE_32BIT, I2S_CHANNEL_MONO);
  
  Serial.println("I2S setup complete!");
}

void recordAudio() {
  Serial.println("Recording audio...");
  
  bytesRead = 0;
  size_t totalBytes = SAMPLE_RATE * RECORD_SECONDS * sizeof(int16_t);
  
  while (bytesRead < totalBytes) {
    size_t bytesToRead = min((size_t)BUFFER_SIZE * sizeof(int32_t), totalBytes - bytesRead);
    size_t bytesReadThisTime = 0;
    
    i2s_read(I2S_PORT, 
             (void*)&audioBuffer[bytesRead / sizeof(int16_t)], 
             bytesToRead, 
             &bytesReadThisTime, 
             portMAX_DELAY);
    
    bytesRead += bytesReadThisTime;
    
    // Convert 32-bit samples to 16-bit
    int samplesRead = bytesReadThisTime / sizeof(int32_t);
    for (int i = 0; i < samplesRead; i++) {
      // Take only the higher 16 bits (INMP441 outputs 24-bit in 32-bit container)
      audioBuffer[(bytesRead - bytesReadThisTime) / sizeof(int16_t) + i] = 
        ((int32_t*)audioBuffer)[i] >> 16;
    }
  }
  
  Serial.print("Recording complete. Samples: ");
  Serial.println(bytesRead / sizeof(int16_t));
}

void sendAudioToServer() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected!");
    return;
  }
  
  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "audio/wav");
  http.addHeader("Device-ID", "ESP32_Argus_001"); // Unique device ID
  http.addHeader("Student-ID", "2702217125"); // Example student ID
  
  // Create WAV header
  byte wavHeader[44];
  createWavHeader(wavHeader, bytesRead / sizeof(int16_t));
  
  // Combine header and audio data
  int totalSize = 44 + bytesRead;
  uint8_t* wavData = new uint8_t[totalSize];
  
  memcpy(wavData, wavHeader, 44);
  memcpy(wavData + 44, audioBuffer, bytesRead);
  
  Serial.println("Sending audio to server...");
  
  int httpResponseCode = http.POST(wavData, totalSize);
  
  if (httpResponseCode > 0) {
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);
    
    String response = http.getString();
    Serial.print("Server response: ");
    Serial.println(response);
  } else {
    Serial.print("Error sending POST: ");
    Serial.println(httpResponseCode);
  }
  
  delete[] wavData;
  http.end();
}

void createWavHeader(byte* header, int sampleCount) {
  int byteRate = SAMPLE_RATE * 1 * 16 / 8;
  int dataSize = sampleCount * 1 * 16 / 8;
  int fileSize = dataSize + 36;
  
  // RIFF chunk
  header[0] = 'R'; header[1] = 'I'; header[2] = 'F'; header[3] = 'F';
  header[4] = (byte)(fileSize & 0xFF);
  header[5] = (byte)((fileSize >> 8) & 0xFF);
  header[6] = (byte)((fileSize >> 16) & 0xFF);
  header[7] = (byte)((fileSize >> 24) & 0xFF);
  header[8] = 'W'; header[9] = 'A'; header[10] = 'V'; header[11] = 'E';
  
  // fmt sub-chunk
  header[12] = 'f'; header[13] = 'm'; header[14] = 't'; header[15] = ' ';
  header[16] = 16; header[17] = 0; header[18] = 0; header[19] = 0; // Subchunk size
  header[20] = 1; header[21] = 0; // Audio format (PCM)
  header[22] = 1; header[23] = 0; // Channels (1 = mono)
  header[24] = (byte)(SAMPLE_RATE & 0xFF);
  header[25] = (byte)((SAMPLE_RATE >> 8) & 0xFF);
  header[26] = (byte)((SAMPLE_RATE >> 16) & 0xFF);
  header[27] = (byte)((SAMPLE_RATE >> 24) & 0xFF);
  header[28] = (byte)(byteRate & 0xFF);
  header[29] = (byte)((byteRate >> 8) & 0xFF);
  header[30] = (byte)((byteRate >> 16) & 0xFF);
  header[31] = (byte)((byteRate >> 24) & 0xFF);
  header[32] = 2; header[33] = 0; // Block align
  header[34] = 16; header[35] = 0; // Bits per sample
  
  // data sub-chunk
  header[36] = 'd'; header[37] = 'a'; header[38] = 't'; header[39] = 'a';
  header[40] = (byte)(dataSize & 0xFF);
  header[41] = (byte)((dataSize >> 8) & 0xFF);
  header[42] = (byte)((dataSize >> 16) & 0xFF);
  header[43] = (byte)((dataSize >> 24) & 0xFF);
}