#include <Arduino.h>
#include <ArduinoJson.h>
#include "DHT22.h"
#include <WiFi.h>
#include <OTAUpdate.h>
#include <Password.h>
#include <Lightsensor.h>
#include <SoilMoisture.h> 
#include <fingerprint_module.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <HTTPClient.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include "time.h"
#include "ConfigWS.h"
#include "esp_wifi.h"
WiFiClient espClient;
PubSubClient client(espClient);

//WiFiClientSecure firebaseClient;

#define FIREBASE_HOST "nhom100htn-default-rtdb.asia-southeast1.firebasedatabase.app"

const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 7 * 3600; //GMT+7
const int   daylightOffset_sec = 0;

volatile float fb_temp =  NAN;
volatile float fb_humi =  NAN;
volatile int fb_light = -1;
volatile float fb_sm = NAN;
unsigned long sampleId = 0;

String device_ID = "ESP32_Device_01";
volatile uint32_t dht_sendInterval = 10000; //Gửi dữ liệu lên Firebase mỗi 10 giây
volatile uint32_t light_sendInterval = 10000; 
volatile uint32_t sm_sendInterval = 10000; 

DynamicJsonDocument configDoc(256);
DynamicJsonDocument controlDoc(256);

const char* mqtt_server = "192.168.90.50";
const int mqtt_port = 1883;
const char* topic_dht = "home/sensors/dht";
const char* topic_light = "home/sensors/light";
const char* topic_sm = "home/sensors/sm";
const char* mqtt_topic_sub = "home/actuators/mqtt";
const char* mqtt_topic_ota = "home/device/fw_version";

ConfigWS wfconf("setup_webserser", "12345678");
Config wifiConfig;

QueueHandle_t fingerQueue;
TaskHandle_t taskMQTT;
SensorDHT22 DHT22sensor(26, DHT22, client, topic_dht);
LightSensor_wRelay LightSensor(34, /*relayPin*/33, client, topic_light);
SoilMoistureSensor SoilMoisture(32, /*pumpPin*/19, client, topic_sm);
FingerprintModule fingerprint(&Serial2, 23, 22);


void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    vTaskDelay(pdMS_TO_TICKS(500));
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
}

void reconnectMQTT() {
  while (!client.connected()) {
    if(WiFi.status() != WL_CONNECTED){
      Serial.println("Wi-Fi lost, reconnecting...");
      connectWiFi();
    }
    Serial.print("Connecting to MQTT...");
    if (client.connect("ESP32_Client")) {
      Serial.println("Connected!");
      client.subscribe(mqtt_topic_sub);
      Serial.println("[MQTT] Subscribed to topic: " + String(mqtt_topic_sub)); 
      OTAUpdate::getInstance()->publishFirmwareVersion(client, mqtt_topic_ota);
    }else{
      Serial.print("Failed, rc=");
      Serial.print(client.state());
      Serial.println(" retrying in 5s...");
      vTaskDelay(pdMS_TO_TICKS(5000));
    }
  }
}

bool firebaseConnected(const String& path, const String& json) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi lost, reconnecting...");
    return false;
  }
  
  String url = String("https://") + String(FIREBASE_HOST) + path + ".json";
  Serial.println("Firebase PUT " + url);
  Serial.println("Payload: " + json);
  
  HTTPClient http;
  WiFiClientSecure firebaseClient;
  firebaseClient.setInsecure(); // Bỏ qua xác thực SSL (chỉ dùng trong môi trường tin cậy)
  http.setTimeout(5000); // Hủy request nếu đợi quá 5 giây
  if(!http.begin(firebaseClient, url)){
    Serial.println("Unable to connect");
    return false;
  }
  
  http.addHeader("Content-Type", "application/json");

  int httpResponseCode = http.PUT(json);
  if(httpResponseCode > 0){
    String response = http.getString();
    Serial.printf("Response code: %d, body: %s\n", httpResponseCode, response.c_str());
  }else{
    Serial.printf("PUT Failed: %s\n", http.errorToString(httpResponseCode).c_str());
  }
  http.end();
  return (httpResponseCode >= 200 && httpResponseCode < 300);
}

bool firebaseGet(const String& path, DynamicJsonDocument& doc) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi lost, reconnecting...");
    return false;
  }

  String url = "https://" + String(FIREBASE_HOST) + path + ".json";
  Serial.println("Firebase GET " + url);
  
  HTTPClient http;
  WiFiClientSecure firebaseClient;
  firebaseClient.setInsecure();
  http.setTimeout(5000); // Hủy request nếu đợi quá 5 giây
  if(!http.begin(firebaseClient, url)){
    Serial.println("Unable to connect");
    return false;
  }

  int httpResponseCode = http.GET();
  if(httpResponseCode > 0){
    String payload = http.getString();
    Serial.printf("GET code: %d, body: %s\n", httpResponseCode, payload.c_str());
    if(payload == "null" || payload.length() == 0){
      http.end();
      doc.clear();
      return false;
    }
    DeserializationError error = deserializeJson(doc, payload);
    http.end();
    if(error){
      Serial.print("JSON Parse Error: ");
      Serial.println(error.c_str());
      return false;
    }
    return true;
  }else{
    Serial.printf("GET Failed: %s\n", http.errorToString(httpResponseCode).c_str());
  }
  http.end();
  return false;
}

void firebaseConfig_Task(void* pvParameters){
  Serial.println("FirebaseConfigTask STARTED on core " + String(xPortGetCoreID()));
  for(;;){
    if(firebaseGet("/devices/dth_1/config", configDoc)){
      if(configDoc.containsKey("sendInterval")){
        uint32_t newInterval = configDoc["sendInterval"];
        if(newInterval < 1000) newInterval = 1000; //Giới hạn tối thiểu 1 giây
        if(newInterval != dht_sendInterval){
          dht_sendInterval = newInterval;
          Serial.printf("Updated dht_sendInterval = %d ms\n", dht_sendInterval);
        }
      }
    }
    configDoc.clear();
    if(firebaseGet("/devices/light_1/config", configDoc)){
      if(configDoc.containsKey("sendInterval")){
        uint32_t newInterval = configDoc["sendInterval"];
        if(newInterval < 1000) newInterval = 1000; //Giới hạn tối thiểu 1 giây
        if(newInterval != light_sendInterval){
          light_sendInterval = newInterval;
          Serial.printf("Updated light_sendInterval = %d ms\n", light_sendInterval);
        }
      }
    }
    configDoc.clear();
    if(firebaseGet("/devices/soil_moisture_1/config", configDoc)){
      if(configDoc.containsKey("sendInterval")){
        uint32_t newInterval = configDoc["sendInterval"];
        if(newInterval < 1000) newInterval = 1000; //Giới hạn tối thiểu 1 giây
        if(newInterval != sm_sendInterval){
          sm_sendInterval = newInterval;
          Serial.printf("Updated sm_sendInterval = %d ms\n", sm_sendInterval);
        }
      }
    }
    vTaskDelay(pdMS_TO_TICKS(5000)); //Kiểm tra config mỗi 5 giây
  }
}

void firebaseControl_Task(void* pvParameters){
  Serial.println("FirebaseControlTask STARTED on core " + String(xPortGetCoreID()));
  for(;;){
    //Lấy lệnh điều khiển từ Firebase
    if(firebaseGet("/control", controlDoc)){
      bool lightAuto = true;
      bool lightManual = false;
      bool pumpOn = false;
      if(controlDoc.containsKey("lightAuto")){
        lightAuto = controlDoc["lightAuto"];
      }
      if(controlDoc.containsKey("light")){
        lightManual = controlDoc["light"];
      }
      if(controlDoc.containsKey("pump")){
        pumpOn = controlDoc["pump"];
      }
      LightSensor.AutoMode(lightAuto);
      //Nếu manual thì đè trạng thái tay này
      if(!lightAuto){
        LightSensor.setManualRelay(lightManual);
      }
      SoilMoisture.setPumpControl(pumpOn);

      Serial.print("Control updated from Firebase:");
      Serial.print(" lightAuto: ");
      Serial.print(lightAuto ? "AUTO" : "MANUAL");
      Serial.print(", light: ");
      Serial.print(lightManual ? "ON" : "OFF");
      Serial.print(", pump: ");
      Serial.println(pumpOn ? "ON" : "OFF");
    }
    controlDoc.clear();
    vTaskDelay(pdMS_TO_TICKS(500)); //Kiểm tra lệnh mỗi 0.5 giây
  }
}

void firebaseLog_Task(void* pvParameters){
  Serial.println("FirebaseLogTask STARTED on core " + String(xPortGetCoreID()));
  for(;;){
    //copy dữ liệu ra biến cục bộ
    float temp = fb_temp;
    float humi = fb_humi;
    int light = fb_light;
    float sm = fb_sm;
    if(!isnan(temp) && !isnan(humi) && light >= 0 && !isnan(sm)){
      struct tm timeinfo;
      if(!getLocalTime(&timeinfo)){
        Serial.println("Failed to obtain time");
      }
      char timeStr[32];
      strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", &timeinfo);
      String logJson = "{";
      logJson += "\"time\":\"" + String(timeStr) + "\",";
      logJson += "\"temperature\": " + String(temp, 1) + ",";
      logJson += "\"humidity\": " + String(humi, 1) + ",";
      logJson += "\"soil_moisture\": " + String(sm, 1) + ",";
      logJson += "\"light\": " + String(light) ;
      logJson += "}";

      sampleId++;
      String path = "/sensorHistory/" + String(sampleId);
      firebaseConnected(path, logJson);
      Serial.println("Logged to: " + path);
    }
    vTaskDelay(pdMS_TO_TICKS(5000)); //Ghi log mỗi 5 giây
  }
}

void firebaseFingerLog_Task(void* pvParameters){
  Serial.println("FirebaseFingerLogTask STARTED on core " + String(xPortGetCoreID()));
  FingerLogData logData;
  for(;;){
    //Chờ dữ liệu từ queue, luôn chờ tới khi có
    if(xQueueReceive(fingerQueue, &logData, portMAX_DELAY) == pdTRUE){
      struct tm timeinfo;
      if(getLocalTime(&timeinfo)){
        char timeStr[32];
        strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", &timeinfo);
        char keyStr[20];
        strftime(keyStr, sizeof(keyStr), "%Y%m%d%H%M%S", &timeinfo);
        String logJson = "{";
        logJson += "\"finger_id\": " + String(logData.id) + ",";
        logJson += "\"status\": \"" + String(logData.status ? "OK" : "FAIL") + "\",";
        logJson += "\"time\": \"" + String(timeStr) + "\"";
        logJson += "}";
        String path = "/fingerHistory/" + String(keyStr);
        firebaseConnected(path, logJson);
        Serial.println("Fingerprint log to: " + path);
      }
    }
  }
}
// void callback(char* topic, byte* payload, unsigned int length) {
//   Serial.print("[callback] ");
//   Serial.println(topic);
//   Serial.print(" -> ");
//   String message;
//   for (unsigned int i = 0; i < length; i++) {
//     message += (char)payload[i];
//   }
//   Serial.print("Received MQTT message: ");
//   Serial.println(message);

//   // Parse JSON
//   DynamicJsonDocument doc(512);
//   DeserializationError error = deserializeJson(doc, message.c_str());

//   if(!error){
//     //Xử lý firmware update
//     if(doc.containsKey("fw_version") && doc.containsKey("fw_url")){
//       String newVersion = doc["fw_version"].as<String>();
//       String newUrl = doc["fw_url"].as<String>();
//       OTAUpdate::getInstance()->checkForUpdate(newVersion, newUrl);
//       //bool ledState = doc["led"];
//       //digitalWrite(LED_PIN, ledState ? HIGH : LOW);
//       //Serial.print("LED State: ");
//       //Serial.println(ledState ? "ON" : "OFF");
//     }
//     //Xử lý máy bơm
//     if(doc.containsKey("pump")){
//       bool on = doc["pump"];
//       Serial.print("Pump command received: ");
//       Serial.println(on ? "ON" : "OFF");
//       SoilMoisture.setPumpControl(on);
//     }else if(doc.containsKey("pump1")){
//       bool on = doc["pump1"];
//       Serial.println(on ? "ON" : "OFF");
//       SoilMoisture.setPumpControl(on);     
//     }
//   }else{ 
//     Serial.print("JSON Parse Error: ");
//     Serial.println(error.c_str());
//   }
// }
// void MQTTSubscribeTask(void *pvParameters) {
//   Serial.println("[MQTT Task] Started MQTTSubscribeTask");
//   for (;;) {
//     if (!client.connected()) {
//       Serial.println("[MQTT Task] MQTT not connected, calling reconnectMQTT()");
//       reconnectMQTT();
//     }
//     client.loop();
//     vTaskDelay(10 / portTICK_PERIOD_MS);  
//   }
// } cái này sai.
 
/*void MQTTSubscribeTask(void* pvParameters){
  Serial.println(">> MQTTSubscribeTask STARTED on core " + String(xPortGetCoreID()));
  client.setServer(mqtt_server, mqtt_port);
  //client.setCallback(callback);
  client.setBufferSize(256);
  client.setKeepAlive(30); // 30 giây

  reconnectMQTT();

  for(;;){
    client.loop();
    vTaskDelay(10 / portTICK_PERIOD_MS);  
  }xài cái này
}*/

void setup() {
  Serial.begin(115200);
  Serial2.begin(57600, SERIAL_8N1, 16, 17);
  //wfconf.clearSavedWiFi();
  if(!wfconf.ensureWiFi(wifiConfig, 15000)){
    Serial.println("Failed to connect to WiFi and get config.");
    //Xử lý khi không kết nối được WiFi
    //Ví dụ: Khởi động lại thiết bị hoặc vào chế độ AP để cấu hình lại
    while(true) vTaskDelay(pdMS_TO_TICKS(1000));
  }
  //connectWiFi();
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("Time synchronized.");
  fingerQueue = xQueueCreate(10, sizeof(FingerLogData));
  if(fingerQueue == NULL){
    Serial.println("Failed to create fingerQueue");
  }
  xTaskCreatePinnedToCore(
      firebaseConfig_Task, 
      "FirebaseConfigTask", 
      8192, 
      NULL, 
      1,      // priority
      NULL, 
      1       // core 1
  );
  // BaseType_t mqttRet = xTaskCreatePinnedToCore(
  //     MQTTSubscribeTask, 
  //     "MQTTTask", 
  //     4096, 
  //     NULL, 
  //     2,      // priority
  //     &taskMQTT, 
  //     1       // core 1
  // );
  // Serial.printf("MQTT task creation ret = %d\n", mqttRet);

  //Khởi tạo các sensor-task
  DHT22sensor.begin(); DHT22sensor.start();
  LightSensor.begin(); LightSensor.start();
  SoilMoisture.begin(); SoilMoisture.start();
  fingerprint.begin(); fingerprint.setLogQueue(fingerQueue); fingerprint.start();
  //xTaskCreatePinnedToCore(MQTTSubscribeTask, "MQTT Subcribe Task", 4096, NULL, 1, &taskMQTT, 1);
  xTaskCreatePinnedToCore(
      firebaseLog_Task, 
      "FirebaseLogTask", 
      8192, 
      NULL, 
      1,      // priority
      NULL, 
      0       // core 0
  );
  xTaskCreatePinnedToCore(
      firebaseControl_Task, 
      "FirebaseControlTask", 
      8192, 
      NULL, 
      1,      // priority
      NULL, 
      0       // core 0
  );
  xTaskCreatePinnedToCore(
      firebaseFingerLog_Task, 
      "FirebaseFingerLogTask", 
      8192, 
      NULL, 
      1,      // priority
      NULL, 
      0       // core 0
  );
}

void loop(){
}

