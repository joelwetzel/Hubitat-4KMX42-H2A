#include <SimpleTimer.h>   // https://github.com/marcelloromani/Arduino-SimpleTimer/tree/master/SimpleTimer
#include <ESP8266WiFi.h>   // if you get an error here you need to install the ESP8266 board manager
#include <ESP8266mDNS.h>   // if you get an error here you need to install the ESP8266 board manager
#include <PubSubClient.h>  // https://github.com/knolleary/pubsubclient
#include <ArduinoOTA.h>    // https://github.com/esp8266/Arduino/tree/master/libraries/ArduinoOTA
#include <AH_EasyDriver.h> // http://www.alhin.de/arduino/downloads/AH_EasyDriver_20120512.zip

/*****************  START USER CONFIG SECTION *********************************/

#define WIFI_SSID ""
#define WIFI_PASSWORD ""
#define USER_MQTT_SERVER "mqtt.local"
#define USER_MQTT_PORT 1883

// Uncomment if your MQTT broker requires authentication
// #define USER_MQTT_USERNAME        "YOUR_MQTT_USER_NAME"
// #define USER_MQTT_PASSWORD        "YOUR_MQTT_PASSWORD"

#define USER_DEVICE_NETWORK_ID "hdmiSwitch" // This must match the Device Network ID in Hubitat

/*****************  END USER CONFIG SECTION *********************************/

WiFiClient espClient;
PubSubClient client(espClient);
SimpleTimer timer;

// Global Variables
bool boot = true;

// Most recently known values for the hdmi switch.  Is it on/off?  Which input is it set to?
char statePublish[50];

const char *ssid = WIFI_SSID;
const char *password = WIFI_PASSWORD;
const char *mqtt_server = USER_MQTT_SERVER;
const int mqtt_port = USER_MQTT_PORT;

// Uncomment if your MQTT broker requires authentication
// const char *mqtt_user = USER_MQTT_USERNAME ;
// const char *mqtt_pass = USER_MQTT_PASSWORD ;

const char *mqtt_device_network_id = USER_DEVICE_NETWORK_ID;

void refresh()
{
  // This is a periodic sync-up of state, in case the user has manually changed inputs on the hdmi switch.
  client.publish("hubitat/" USER_DEVICE_NETWORK_ID "/attributes/status", "REFRESH");

  // Send a command to the hdmi switch, asking for the current input
  Serial.printf("GET MP OUT1\r\n");
}

void processMqttMessage(char *topic, byte *payload, unsigned int length)
{
  // Message arrived
  String newTopic = topic;
  payload[length] = '\0';
  String newPayload = String((char *)payload);
  int intPayload = newPayload.toInt();

  if (newTopic == "hubitat/" USER_DEVICE_NETWORK_ID "/commands/setSwitch")
  {
    // Send the command to the hdmi switch, over the serial port
    if (intPayload)
    {
      Serial.printf("SET CEC_PWR OUT1 ON\r\n");
    }
    else
    {
      Serial.printf("SET CEC_PWR OUT1 OFF\r\n");
    }
  }
  else if (newTopic == "hubitat/" USER_DEVICE_NETWORK_ID "/commands/setInputSource")
  {
    // Send the command to the hdmi switch, over the serial port
    Serial.printf("SET SW IN%d OUT1\r\n", intPayload);
  }
  else if (newTopic == "hubitat/" USER_DEVICE_NETWORK_ID "/commands/refresh")
  {
    refresh();
  }
}

void readFromSerial()
{
  // Read from serial.  It will be a response from a command sent either by processMqttMessage, or by refresh().

  String message = Serial.readString();

  if (message.length() == 0)
  {
    return;
  }

  message.trim();

  client.publish("hubitat/" USER_DEVICE_NETWORK_ID "/attributes/read", message.c_str());

  // Is it a message about the currently selected input?
  if (message.startsWith("SW ") || message.startsWith("MP "))
  {
    char inputChar = message[5];

    client.publish("hubitat/" USER_DEVICE_NETWORK_ID "/attributes/mediaInputSource", String(inputChar).c_str());
  }

  // Is it a response to a power command?
  if (message.startsWith("CEC_PWR OUT1 "))
  {
    if (message.startsWith("CEC_PWR OUT1 ON"))
    {
      client.publish("hubitat/" USER_DEVICE_NETWORK_ID "/attributes/switch", "1");
    }
    else
    {
      client.publish("hubitat/" USER_DEVICE_NETWORK_ID "/attributes/switch", "0");
    }
  }
}

void sendHeartbeat()
{
  client.publish("hubitat/" USER_DEVICE_NETWORK_ID "/attributes/status", "HEARTBEAT");
}

void setup_wifi()
{
  // We start by connecting to a WiFi network
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
  }
}

void reconnect()
{
  int retries = 0;
  int maxRetries = 150;

  while (!client.connected())
  {
    if (retries < maxRetries)
    {
      if (client.connect(mqtt_device_network_id)) // Password option:  client.connect(mqtt_device_network_id, mqtt_user, mqtt_pass)
      {
        if (boot == false)
        {
          client.publish("hubitat/" USER_DEVICE_NETWORK_ID "/attributes/status", "RECONNECTED");
          client.publish("hubitat/" USER_DEVICE_NETWORK_ID "/attributes/ip", WiFi.localIP().toString().c_str());
        }
        if (boot == true)
        {
          client.publish("hubitat/" USER_DEVICE_NETWORK_ID "/attributes/status", "REBOOTED");
          client.publish("hubitat/" USER_DEVICE_NETWORK_ID "/attributes/ip", WiFi.localIP().toString().c_str());
          boot = false;
        }

        // ... and resubscribe to topics
        client.subscribe("hubitat/" USER_DEVICE_NETWORK_ID "/commands/setSwitch");
        client.subscribe("hubitat/" USER_DEVICE_NETWORK_ID "/commands/setInputSource");
        client.subscribe("hubitat/" USER_DEVICE_NETWORK_ID "/commands/refresh");
      }
      else
      {
        retries++;
        // Wait 5 seconds before retrying
        delay(5000);
      }
    }

    if (retries >= maxRetries)
    {
      ESP.restart();
    }
  }
}

void setup()
{
  Serial.begin(115200);
  Serial.setTimeout(300);

  WiFi.mode(WIFI_STA);
  setup_wifi();

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(processMqttMessage);
  ArduinoOTA.setHostname(USER_DEVICE_NETWORK_ID);
  ArduinoOTA.begin();

  delay(10);

  timer.setInterval(90000, sendHeartbeat);
  timer.setInterval(30 * 1000, refresh);
  timer.setInterval(1000, readFromSerial);
}

void loop()
{
  if (!client.connected())
  {
    reconnect();
  }

  client.loop();
  ArduinoOTA.handle();
  timer.run();
}
