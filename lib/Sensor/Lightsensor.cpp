#include <Lightsensor.h>
#include <Arduino.h>
#include <ArduinoJson.h>

extern int fb_light;
extern uint32_t light_sendInterval;
bool firebaseConnected(const String& path, const String& json);
static const char* light_device_ID= "light_1";

LightSensor_wRelay::LightSensor_wRelay(uint8_t pin, uint8_t relayPin, PubSubClient& mqttClient, const char* mqttTopic)
  : TaskBase("LightSensorTask", 2048, 1, 1), 
    pin(pin), relayPin(relayPin), 
    client(mqttClient), 
    topic(mqttTopic),
    lightStatus(false), 
    autoMode(true), //mặc định là chạy auto
    manual(false),
    relayStatus(false) {}

void LightSensor_wRelay::begin() {
  pinMode(pin, INPUT);
  pinMode(relayPin, OUTPUT);
  //digitalWrite(relayPin, LOW); // Relay off by default
  relayStatus = false;
  RelayOutput();
}

bool LightSensor_wRelay::getLightStatus() {
  return lightStatus;
}

bool LightSensor_wRelay::getRelayStatus() const {
  return relayStatus;
}

void LightSensor_wRelay::AutoMode(bool ena) {
  autoMode = ena;
  Serial.print("Light Sensor Auto Mode: ");
  Serial.println(autoMode ? "ON" : "OFF");
}

bool LightSensor_wRelay::isAutoMode() const {
  return autoMode;
}

void LightSensor_wRelay::setManualRelay(bool on) {
  autoMode = false; //Tắt auto khi điều khiển tay
  manual = on;
  Serial.print("Light manual control: ");
  Serial.println(on ? "ON" : "OFF");
  RelayOutput();
}

void LightSensor_wRelay::RelayOutput() {
  digitalWrite(relayPin, relayStatus ? LOW : HIGH); 
}
void LightSensor_wRelay::run() {
  while (1) {
    int a = digitalRead(pin);
    lightStatus = (a == HIGH); // Giả sử HIGH là có ánh sáng, LOW là tối
    fb_light = lightStatus ? 1 : 0;
    bool targetRelay = relayStatus;
    if(autoMode){
      bool Dark = (lightStatus == false);
      targetRelay = Dark; //Nếu tối thì bật relay
    }else{
      targetRelay = manual;
    }
    if(targetRelay != relayStatus){
      relayStatus = targetRelay;
      RelayOutput();

      Serial.print("Relay turned ");;
      Serial.print(autoMode ? "AUTO" : "MANUAL");
      Serial.print(" -> ");
      Serial.println(relayStatus ? "ON" : "OFF");
    }
    Serial.print("Light Status: ");
    Serial.println(lightStatus ? "Sáng" : "Tối");

    //digitalWrite(relayPin, lightStatus ? LOW : HIGH); // Turn on relay if light is detected
    // String fbJson = "{";
    // fbJson += "\"device_id\": \"" + String(light_device_ID) + "\",";
    // fbJson += "\"light_status\": " + String(lightStatus ? 1 : 0);
    // fbJson += "}";

    // String path = "/devices/" + String(light_device_ID) + "/telemetry/light";
    // //firebaseConnected(path, fbJson);

    uint32_t interval = light_sendInterval;
    if(interval < 1000) interval = 1000;
    vTaskDelay(interval / portTICK_PERIOD_MS);
  }
}