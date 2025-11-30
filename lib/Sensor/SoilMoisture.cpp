// SoilMoisture.cpp
#include <SoilMoisture.h>
#include <Arduino.h>
#include <ArduinoJson.h>

extern float fb_sm;
volatile extern uint32_t sm_sendInterval;
bool firebaseConnected(const String& path, const String& json);
static const char* sm_device_ID= "soil_moisture_1";

SoilMoistureSensor::SoilMoistureSensor(uint8_t analogpin, uint8_t relay_sm_pin, PubSubClient& mqttClient, const char* pubTopic)
  : TaskBase("SoilMoistureTask", 2048, 1, 1), 
    analogpin(analogpin), relay_sm_pin(relay_sm_pin), 
    client(mqttClient), 
    pubTopic(pubTopic),
    moistureLevel(0),
    moisture_percent(0.0),
    pumpState(false) {}

void SoilMoistureSensor::begin() {
    pinMode(analogpin, INPUT);
    pinMode(relay_sm_pin, OUTPUT);
    digitalWrite(relay_sm_pin, LOW); // Relay off by default
}

void SoilMoistureSensor::run() {
    while (1) {
        moistureLevel = analogRead(analogpin);
        moisture_percent = 100 - map(moistureLevel, 0, 4095, 0, 100); // Convert to percentage
        fb_sm = moisture_percent;
        Serial.print("Soil Moisture: ");
        Serial.print(moisture_percent);
        Serial.println(" %");

        // String fbJson = "{";
        // fbJson += "\"device_id\": \"" + String(sm_device_ID) + "\",";
        // fbJson += "\"moisture_level\": " + String(moisture_percent, 1);
        // fbJson += "}";

        // String path = "/devices/" + String(sm_device_ID) + "/telemetry/soil_moisture";
        // //firebaseConnected(path, fbJson);

        uint32_t interval = 0;
        while (interval < sm_sendInterval){
        vTaskDelay(1000/portTICK_PERIOD_MS);
        interval += 1000;
        if(interval >= sm_sendInterval) break;
        }
    }
}

int SoilMoistureSensor::getMoistureLevel() const{
    return moistureLevel;
}

void SoilMoistureSensor::setPumpControl(bool on) {
    pumpState = on;
    digitalWrite(relay_sm_pin, on ? HIGH : LOW); // Set pump state
    Serial.println(on ? "Pump ON (Manual Mode)" : "Pump OFF (Manual Mode)");
}