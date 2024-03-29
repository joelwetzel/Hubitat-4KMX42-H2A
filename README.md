# Hubitat-4KMX42-H2A
Hubitat device driver, and ESP firmware, to connect to my custom ESP8266 that controls an HDMI switch.

First I had to find an HDMI switch with the features I wanted, that I believed I could control.  I bought and tested several.  I settled on the AV Access 4KMX42-H2A:  https://www.avaccess.com/products/4kmx42-h2a/

- It has 4 inputs and 2 outputs.  I don't need the 2nd output, but it's not a problem.
- It can turn the tv on and off via CEC.  We already have tv power control, but it doesn't hurt to have an extra way to do this.
- With HDCP 2.2, it supports resolutions up to 4K@60Hz HDR.
- It can be controlled via Serial interface.  The API reference is here:  https://avaccess.com/wp-content/uploads/2022/03/API-Command-Set_4KMX42-H2A-V1.0.0.pdf

***Sidenote about HDMI switches:  HDMI switches are notorious for interrupting the EDID handshakes between source devices and TVs.  Some sources can handle this gracefully, and some can't.  I discovered that the Apple TV had trouble with it, which would manifest as the screen periodically going blank.  I solved this by buying and installing a [Dr.HDMI EDID Manager](https://hdfury.com/product/dr-hdmi-8k/) in between the Apple TV and the HDMI Switch.  This device provides a steady EDID handshake to the Apple TV, alleviating the issues.***

Next, this hdmi switch can be controlled via Serial.  How to connect to that from Hubitat?  There are many ways, but my approach was:

1. Write a driver for Hubitat.  This driver publishes/subscribesTo messages over MQTT.
2. I already had an MQTT server running in my network, for other projects.
3. Write firmware for an ESP8266 board.  It will publish/subscribeTo messages over MQTT, in order to communicate with the Hubitat driver.
4. The ESP board can talk to the HDMI switch over serial.  However, ESP8266 outputs serial as TTY, not RS232.  The HDMI switch expects RS232.  So I have to pass the signal through a converter:  https://www.amazon.com/gp/product/B091TN2ZPY/ref=ppx_yo_dt_b_search_asin_title?ie=UTF8&psc=1

***Sidenote:  Of course this could be done without MQTT...  My ESP firmware could expose a webserver for the Hubitat driver to contact directly.  But I've already had experience and success mediating through MQTT, and especially like the traceability it gives me while debugging.  So I've kept that complication.***

![esp_hdmi_switch](https://github.com/joelwetzel/Hubitat-4KMX42-H2A/assets/5503931/dd6dbf99-1c6e-4e6f-b5c7-ef1ee5fe189a)

- In this photo, you can see the TTY -> RS232 converter.
- The only output wires from the ESP8266 are the 4 necessary for serial communication.
- I put a switch inline on the red wire.  I flip this switch (to disconnect the red wire) if I need to reprogram the ESP over its USB port.  If you don't do this, the serial communications to the 4KMX42 interfere with the serial communications across the USB port, preventing reprogramming.
