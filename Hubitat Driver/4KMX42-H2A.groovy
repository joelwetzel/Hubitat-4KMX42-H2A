/**
 *  AV Access 4KMX42-H2A HDMI Switch Driver
 *
 *  Copyright 2023 Joel Wetzel
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License. You may obtain a copy of the License at:
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License
 *  for the specific language governing permissions and limitations under the License.
 *
 */

import groovy.time.*
	
metadata {
	definition (name: "AV Access 4KMX42-H2A", namespace: "joelwetzel", author: "Joel Wetzel", description: "TODO") {
		capability "MediaInputSource"
        capability "Switch"
        capability "Refresh"
		
		attribute "supportedInputs", "string"
        attribute "mediaInputSource", "string"
        
        attribute "driverStatus", "string"
        attribute "deviceStatus", "string"
        attribute "readOnSerial", "string"
        
        command "setInputSource", [[name: "Input Source*", type:"STRING"]]
	}
    
    preferences {
		section {
			input (
				type: "String",
				name: "mqttHubIp",
				title: "MQTT Hub IP Address",
				required: true,
				defaultValue: "192.168.1.44"
			)
            input (
				type: "bool",
				name: "enableDebugLogging",
				title: "Enable Debug Logging?",
				required: true,
				defaultValue: false
			)
		}
	}
}

def parse(String description) {
    def decoded = interfaces.mqtt.parseMessage(description)
    //log ("${decoded.topic} : ${decoded.payload}")
    
    if (decoded.topic == topicNameAttribute("switch")) {
        def deviceReportedSwitch = decoded.payload.toInteger()
        if (deviceReportedSwitch == 1) {
            log("MQTT MESSAGE RECEIVED: switch on")
            sendEvent(name: "switch", value: "on")
        }
        else {
            log("MQTT MESSAGE RECEIVED: switch off")
            sendEvent(name: "switch", value: "off")
        }
    }
    else if (decoded.topic == topicNameAttribute("mediaInputSource")) {
        log("MQTT MESSAGE RECEIVED: mediaInputSource ${decoded.payload}")
        sendEvent(name: "mediaInputSource", value: decoded.payload)
    }
    else if (decoded.topic == "hubitat/${device.getDeviceNetworkId()}/attributes/read") {
        sendEvent(name: "readOnSerial", value: decoded.payload)
    }
    else if (decoded.topic == "hubitat/${device.getDeviceNetworkId()}/attributes/status") {
        sendEvent(name: "deviceStatus", value: decoded.payload)
    }
}

def log (msg) {
	if (enableDebugLogging) {
		log.debug msg
	}
}


def installed () {   
	log.info "${device.displayName}.installed()"
    
    initialize()
    runEvery1Hour(initialize)
}

def uninstalled () {
    interfaces.mqtt.disconnect()
}


def updated () {
    initialize()
    
	log.info "${device.displayName}.updated()"
}


def initialize() {
	log.info "${device.displayName}.initialize()"
	
	// Default values
    sendEvent(name: "supportedInputs", value: "HDMI1,HDMI2,HDMI3,HDMI4", isStateChange: true)
    
    if (interfaces.mqtt.isConnected()) {
        log "Disconnecting..."
        interfaces.mqtt.disconnect()
    }
    
    runIn(1, connectToMqtt)
}


def setInputSource(value) {
    if (!interfaces.mqtt.isConnected()) {
        connectToMqtt()
        return
    }
    
    log("SENDING: setInputSource ${value}")
    interfaces.mqtt.publish(topicNameCommand("setInputSource"), value)
}

def on() {
    if (!interfaces.mqtt.isConnected()) {
        connectToMqtt()
        return
    }
    
    log("SENDING: setSwitch 1")
    interfaces.mqtt.publish(topicNameCommand("setSwitch"), "1")
}

def off() {
    if (!interfaces.mqtt.isConnected()) {
        connectToMqtt()
        return
    }
    
    log("SENDING: setSwitch 0")
    interfaces.mqtt.publish(topicNameCommand("setSwitch"), "0")
}

def refresh() {
    if (!interfaces.mqtt.isConnected()) {
        connectToMqtt()
        return
    }
    
    log("SENDING: refresh")
    interfaces.mqtt.publish(topicNameCommand("refresh"), "1")
}

def mqttClientStatus(String status) {
    log "mqttClientStatus(${status})"

    if (status.take(6) == "Error:") {
        log.error "MQTT Connection error..."
        sendEvent(name: "driverStatus", value: "ERROR: ${status}")
        
        try {
            interfaces.mqtt.disconnect()  // clears buffers
        }
        catch (e) {
        }
        
        log.info("Attempting to reconnect to MQTT in 5 seconds...");
        runIn(5, connectToMqtt)
    }
    else {
        log.info "Connected to MQTT"
        sendEvent(name: "driverStatus", value: "CONNECTED")
    }
}

def connectToMqtt() {
    log "connectToMqtt()"
    
    if (!interfaces.mqtt.isConnected()) {        
        log "Connecting to MQTT..."
        sendEvent(name: "driverStatus", value: "CONNECTING")
        interfaces.mqtt.connect("tcp://${mqttHubIp}:1883", device.getDeviceNetworkId() + "driver", null, null)
        
        runIn(1, subscribe)
    }
}

def subscribe() {
    log "Subscribing..."
    
    // Track device status
    interfaces.mqtt.subscribe("hubitat/${device.getDeviceNetworkId()}/attributes/status")
    interfaces.mqtt.subscribe("hubitat/${device.getDeviceNetworkId()}/attributes/read")
    
    // Subscribe to attributes
    interfaces.mqtt.subscribe(topicNameAttribute("switch"))
    interfaces.mqtt.subscribe(topicNameAttribute("mediaInputSource"))
    
    runIn(1, refresh)
}

def topicNameCommand(String command) {
    // We're "sort of" using the homie mqtt convention.
    // https://homieiot.github.io
        
    def topicBase = "hubitat/${device.getDeviceNetworkId()}"
    
    def topicName = "${topicBase}/commands/${command}"
    
    return topicName
}

def topicNameAttribute(String attribute) {
    // We're "sort of" using the homie mqtt convention.
    // https://homieiot.github.io
        
    def topicBase = "hubitat/${device.getDeviceNetworkId()}"
    
    def topicName = "${topicBase}/attributes/${attribute}"
    
    return topicName
}
