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
    lightStatus(false) {}

void LightSensor_wRelay::begin() {
  pinMode(pin, INPUT);
  pinMode(relayPin, OUTPUT);
  digitalWrite(relayPin, LOW); // Relay off by default
}

bool LightSensor_wRelay::getLightStatus() {
  return lightStatus;
}

void LightSensor_wRelay::run() {
  while (1) {
    lightStatus = digitalRead(pin);
    fb_light = lightStatus ? 1 : 0;
    Serial.print("Light Status (1 = Sang, 0 = Toi): ");
    Serial.println(lightStatus);

    digitalWrite(relayPin, lightStatus ? LOW : HIGH); // Turn on relay if light is detected
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