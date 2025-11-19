#ifndef LIGHT_SENSOR_H
#define LIGHT_SENSOR_H

#include <TaskBase.h>
#include <PubSubClient.h>

class LightSensor_wRelay : public TaskBase {
public:
    LightSensor_wRelay(uint8_t pin, uint8_t relayPin, PubSubClient& mqttClient, const char* mqttTopic);

    void begin();
    bool getLightStatus(); //trạng thái cảm biến
    bool getRelayStatus() const; //trạng thái relay
    //chế độ auto cho cảm biến
    void AutoMode(bool ena);
    bool isAutoMode() const;
    //đè điều khiển tay
    void setManualRelay(bool on);

protected:
    void run() override;

private:
    uint8_t pin;
    uint8_t relayPin;
    PubSubClient& client;
    const char* topic;
    bool lightStatus;
    bool relayStatus;
    bool autoMode;
    bool manual;
    void RelayOutput(); //Cập nhật trạng thái relay dựa trên chế độ và trạng thái cảm biến
};
#endif // LIGHT_SENSOR_H