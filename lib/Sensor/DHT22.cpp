#include <DHT22.h>

extern float fb_temp;
extern float fb_humi;
volatile extern uint32_t dht_sendInterval;
bool firebaseConnected(const String& path, const String& json);
static const char* dht_device_ID = "dth_1";

SensorDHT22::SensorDHT22(uint8_t pin, uint8_t type, PubSubClient& mqttClient, const char* mqttTopic)
  : TaskBase("SensorDHT22Task", 2048, 1, 1), 
    dht(pin, type), client(mqttClient), 
    topic(mqttTopic),
    temperature(0.0), humidity(0.0) {}

void SensorDHT22::begin() {
  dht.begin();
}

float SensorDHT22::getTemperature() {
  return temperature;
}

float SensorDHT22::getHumidity() {
  return humidity;
}

void SensorDHT22::run() {
  while (1) {
    temperature = dht.readTemperature();
    humidity = dht.readHumidity();

    if (!isnan(temperature) && !isnan(humidity)) {
      fb_temp = temperature;
      fb_humi = humidity;
      Serial.print("Temp: "); Serial.print(temperature); Serial.print(" *C");
      Serial.print(" Humi: "); Serial.print(humidity); Serial.println(" %");
      // String fbJson = "{";
      // fbJson += "\"device_id\": \"" + String(dht_device_ID) + "\",";
      // fbJson += "\"temperature\": " + String(temperature, 2) + ",";
      // fbJson += "\"humidity\": " + String(humidity, 2);
      // fbJson += "}";

      // //String path = "/devices/" + String(dht_device_ID) + "/telemetry/dht";
      // //firebaseConnected(path, fbJson);
    } else {
      Serial.println("Failed to read DHT sensor.");
    }
    uint32_t interval = 0;
    while (interval < dht_sendInterval){
      vTaskDelay(1000/portTICK_PERIOD_MS);
      interval += 1000;
      if(interval >= dht_sendInterval) break;
    }
  }
}
