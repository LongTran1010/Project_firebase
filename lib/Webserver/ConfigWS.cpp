#include "ConfigWS.h"


const char* ConfigWS::PREF_NAMESPACE = "wifi_config";
const char* ConfigWS::PREF_KEY_SSID   = "ssid";
const char* ConfigWS::PREF_KEY_PASS   = "pass";

static const char CONFIG_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ESP32 WiFi Config</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 420px; margin: 20px auto; }
    h2 { text-align:center; }
    label { display:block; margin-top: 12px; font-weight: 600; }
    input { width:100%; padding:8px; border-radius:8px; border:1px solid #d1d5db; box-sizing:border-box; }
    button {
      margin-top:16px; width:100%; padding:10px;
      border:none; border-radius:999px;
      background:#2563eb; color:#fff; font-weight:600; font-size:14px;
    }
  </style>
</head>
<body>
  <h2>ESP32 WiFi Config</h2>
  <form action="/save" method="POST">
    <label>SSID
      <input name="ssid" placeholder="WiFi SSID" required>
    </label>
    <label>Password
      <input name="pass" type="password" placeholder="WiFi password">
    </label>
    <button type="submit">Save &amp; Connect</button>
  </form>
</body>
</html>
)rawliteral";

ConfigWS::ConfigWS(const char* AP_ssid, const char* AP_pass)
  : _AP_ssid(AP_ssid), _AP_pass(AP_pass), server(80), prefs(), cfg(), SuccessConnect(false) {
}

bool ConfigWS::load(Config& outConfig) {
  prefs.begin(PREF_NAMESPACE, true);
  outConfig.ssid = prefs.getString(PREF_KEY_SSID, "");
  outConfig.pass = prefs.getString(PREF_KEY_PASS, "");
  prefs.end();

  Serial.println("Loaded WiFi: SSID='" + outConfig.ssid + "'");
  return outConfig.ssid.length() > 0;
}

bool ConfigWS::connectSTA(uint32_t timeoutMs) {
  if(cfg.ssid.isEmpty()) {
    return false;
  }
  WiFi.mode(WIFI_STA);
  WiFi.begin(cfg.ssid.c_str(), cfg.pass.c_str());

  Serial.println("Connecting to WiFi SSID='" + cfg.ssid + "' ...");

  uint32_t startAttemptTime = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - startAttemptTime) < timeoutMs) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if(WiFi.status() == WL_CONNECTED) {
    Serial.println("Connected! IP address: " + WiFi.localIP().toString());
    return true;
  } else {
    Serial.println("Failed to connect");
    return false;
  }
  Serial.println();
}

void ConfigWS::startAP() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(_AP_ssid, _AP_pass);
  Serial.println("Started AP SSID='" + String(_AP_ssid) + "'");
  Serial.println("AP IP address: " + WiFi.softAPIP().toString());
}

void ConfigWS::handleRoot() {
  server.send_P(200, "text/html", CONFIG_HTML);
}

void ConfigWS::handleSave(){
  if(server.method() != HTTP_POST) {
    server.send(405, "text/plain", "Method Not Allowed");
    return;
  }

  String ssid = server.arg("ssid");
  String pass = server.arg("pass");
  if(ssid.length() == 0) {
    server.send(400, "text/plain", "Bad Request: SSID is required");
    return;
  }

  cfg.ssid = ssid;
  cfg.pass = pass;
  // Lưu vào NVS
  prefs.begin(PREF_NAMESPACE, false);
  prefs.putString(PREF_KEY_SSID, cfg.ssid);
  prefs.putString(PREF_KEY_PASS, cfg.pass);
  prefs.end();


  
  Serial.println("Saved WiFi: SSID='" + cfg.ssid + "'");

  server.send(200, "text/html", "Configuration saved. Trying to connect...");
  SuccessConnect = true;
}

void ConfigWS::setupRoutes(){
  server.on("/", HTTP_GET, [this]() {this->handleRoot(); });
  server.on("/save", HTTP_POST, [this]() {this->handleSave(); });
}

void ConfigWS::loopPortal() {
  SuccessConnect = false;
  startAP();
  setupRoutes();
  server.begin();
  
  Serial.println("Waiting for configuration...");

  while(!SuccessConnect) {
    server.handleClient();
    delay(10);
  }

  server.stop();
  WiFi.softAPdisconnect(true);
  Serial.println("Configuration portal stopped.");
}

//API chính, đảm bảo có wifi, nếu cần thì vô chế độ config
bool ConfigWS::ensureWiFi(Config& outConfig, uint32_t connectTimeoutMs) {
  //1) Thử load config & connect
  if(load(cfg)) {
    outConfig = cfg;
    if(connectSTA(connectTimeoutMs)) {
      return true;
    }
    Serial.println("Failed to connect with saved config, fall back to AP mode.");
  }

  //2) Mở AP + webserver cho user cấu hình
  loopPortal();

  //3) Thử connect lại với config mới
  if(SuccessConnect && connectSTA(connectTimeoutMs)) {
    outConfig = cfg;
    return true;
  }

  return false;
}

