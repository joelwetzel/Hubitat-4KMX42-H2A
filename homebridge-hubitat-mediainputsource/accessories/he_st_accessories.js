var inherits = require('util').inherits;
var Accessory, Service, Characteristic, uuid, CommunityTypes, platformName, capabilityToAttributeMap;
const util = require('util');
var version = require('../package.json').version;
const pluginName = 'homebridge-hubitat-mediainputsource';
const mired = require('mired');
const validateValue = require('../lib/validate').validateValue;
/*
 *   HE_ST Accessory
 */
module.exports = function (oAccessory, oService, oCharacteristic, oPlatformAccessory, ouuid, platName) {
    platformName = platName;
    if (oAccessory) {
        Accessory = oPlatformAccessory || oAccessory;
        Service = oService;
        Characteristic = oCharacteristic;
        CommunityTypes = require('../lib/communityTypes')(Service, Characteristic);
        uuid = ouuid;
        capabilityToAttributeMap = require('./exclude_capability').capabilityToAttributeMap();
        //        inherits(HE_ST_Accessory, Accessory);
        HE_ST_Accessory.prototype.loadData = loadData;
        HE_ST_Accessory.prototype.getServices = getServices;
        HE_ST_Accessory.prototype.updateAttributes = updateAttributes;
    }
    return HE_ST_Accessory;
};
module.exports.HE_ST_Accessory = HE_ST_Accessory;
module.exports.uuidGen = uuidGen;
module.exports.uuidDecrypt = uuidDecrypt;

function uuidGen(deviceid) {
    return uuid.generate('hbdev:' + platformName.toLowerCase() + ':' + deviceid);
}
function uuidDecrypt(buffer) {
    return uuid.unparse(buffer);
}
function toTitleCase(str) {
    return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}
function dump(name, inVar) {
    console.log(inVar);
    for (var k in inVar.accessory.services) {
        console.log(name + ':ser:' + inVar.accessory.services[k].UUID + ':' + inVar.accessory.services[k].displayName);
        for (var l in inVar.accessory.services[k].optionalCharacteristics) {
            console.log(name + ':opt:'.inVar.accessory.services[k].optionalCharacteristics[l].UUID + ':' + inVar.accessory.services[k].optionalCharacteristics[l].displayName);
        }
        for (var l in inVar.accessory.services[k].characteristics) {
            console.log(name + ':cha:'.inVar.accessory.services[k].characteristics[l].UUID + ':' + inVar.accessory.services[k].characteristics[l].displayName);
        }
    }
}

function HE_ST_Accessory(platform, group, device, accessory) {
    this.deviceid = device.deviceid;
    this.name = device.name;
    this.platform = platform;
    this.state = {};
    this.device = device;
    this.unregister = false;
    this.programmableButton = device.programmableButton;
    var id = uuidGen(this.deviceid);
    //Accessory.call(this, this.name, id);

    if ((accessory !== undefined) && (accessory !== null))
        this.accessory = accessory;
    else
        this.accessory = new Accessory(this.name, id);
    this.accessory.name = this.name;
    this.accessory.getServices = function () { return this.accessory.services };
    var that = this;

    function deviceIsFan() {
        if (device.attributes && device.attributes.hasOwnProperty('speed'))
            return true;
        if (device.commands && device.commands.hasOwnProperty('setSpeed'))
            return true;
        if (device.capabilities && device.capabilities.hasOwnProperty('FanControl'))
            return true;
        if ((device.type) && ((device.type.toLowerCase().indexOf('fan control') > -1) || (device.type.toLowerCase().indexOf('fan component') > -1)))
            return true;
        return false;
    }

    function deviceHasAttributeCommand(attribute, command) {
        return (that.device.attributes.hasOwnProperty(attribute) && that.device.commands.hasOwnProperty(command));
    }


    if ((accessory !== null) && (accessory !== undefined)) {
        removeExculdedAttributes();
    }
    //Removing excluded attributes from config
    for (var i = 0; i < that.device.excludedAttributes.length; i++) {
        let excludedAttribute = device.excludedAttributes[i];
        if (that.device.attributes.hasOwnProperty(excludedAttribute)) {
            platform.log("Removing attribute: " + excludedAttribute + " for device: " + device.name);
            delete that.device.attributes[excludedAttribute];
        }
    }
    for (var i = 0; i < that.device.excludedCapabilities.length; i++) {
        let excludedCapability = device.excludedCapabilities[i].toLowerCase();
        if (that.device.capabilities.hasOwnProperty(excludedCapability)) {
            for (var key in capabilityToAttributeMap) {
                if (capabilityToAttributeMap.hasOwnProperty(key)) {
                    if (key === excludedCapability) {
                        platform.log("Removing capability: " + excludedCapability + " for device: " + device.name);
                        for (var k = 0; k < capabilityToAttributeMap[key].length; k++) {
                            var excludedAttribute = capabilityToAttributeMap[key][k];
                            if (that.device.attributes.hasOwnProperty(excludedAttribute)) {
                                delete that.device.attributes[excludedAttribute];
                            }
                        }
                    }
                }
            }
        }
    }

    //Removing excluded attributes from config
    function removeExculdedAttributes() {
        //that.platform.log('Having a cached accessory, build a duplicate and see if I can detect obsolete characteristics');
        var _device = device.deviceid;
        device.deviceid = 'filter' + _device.deviceid;
        var newAccessory = new HE_ST_Accessory(platform, group, device);

        for (var k in that.accessory.services) {
            for (var l in that.accessory.services[k].optionalCharacteristics) {
                var remove = true;
                for (var j in newAccessory.accessory.services) {
                    for (var t in newAccessory.accessory.services[j].optionalCharacteristics) {
                        if (that.accessory.services[k].optionalCharacteristics[l].UUID === newAccessory.accessory.services[j].optionalCharacteristics[t].UUID)
                            remove = false;
                    }
                }
                if (remove === true)
                    that.accessory.services[k].removeCharacteristic(that.accessory.services[k].optionalCharacteristics[l]);
            }

            for (var l in that.accessory.services[k].characteristics) {
                var remove = true;
                for (var j in newAccessory.accessory.services) {
                    for (var t in newAccessory.accessory.services[j].characteristics) {
                        if (that.accessory.services[k].characteristics[l].UUID === newAccessory.accessory.services[j].characteristics[t].UUID)
                            remove = false;
                    }
                }
                if (remove === true)
                    that.accessory.services[k].removeCharacteristic(that.accessory.services[k].optionalCharacteristics[l]);
            }
            var removeService = true;
            for (var l in newAccessory.accessory.services) {
                if (newAccessory.accessory.services[l].UUID === that.accessory.services[k].UUID)
                    removeService = false;
            }
            if (removeService === true)
                that.accessory.removeService(that.accessory.services[k]);
        }
        device.deviceid = _device;
        return;
    }

    that.getaddService = function (Service, name, subType) {
        var myService = that.accessory.getService(Service);
        if (!myService) {
            myService = that.accessory.addService(Service, name, subType);
        }
        return myService;
    };

    that.getaddService(Service.AccessoryInformation).setCharacteristic(Characteristic.Name, that.name);
    that.accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.FirmwareRevision, version);
    that.accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Manufacturer, 'Hubitat');
    that.accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Model, platformName);
    that.accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.SerialNumber, group + ':' + device.deviceid);
    that.accessory.on('identify', function (paired, callback) {
        that.platform.log("%s - identify", that.accessory.displayName);
        callback();
    });

    that.getaddService = function (Service) {
        var myService = that.accessory.getService(Service);
        if (!myService) {
            myService = that.accessory.addService(Service);
        }
        return myService;
    };
    that.deviceGroup = 'unknown'; // that way we can easily tell if we set a device group
    var thisCharacteristic;
    //platform.log('loading device: ' + JSON.stringify(device));

    if (group === "mode") {
        that.deviceGroup = "mode";
        thisCharacteristic = that.getaddService(Service.Switch).getCharacteristic(Characteristic.On)
            .on('get', function (callback) {
                var character = this;
                callback(null, that.device.attributes.switch === 'on');
            })
            .on('set', function (value, callback) {
                if (value && that.device.attributes.switch === 'off') {
                    platform.api.setMode(that.device.attributes.modeid).then(function (resp) { callback(null); }).catch(function (err) { callback(err); });
                }
            });
        platform.addAttributeUsage('switch', device.deviceid, thisCharacteristic);
    }
    if (group === "reboot") {
        that.deviceGroup = "reboot";
        thisCharacteristic = that.getaddService(Service.Switch).getCharacteristic(Characteristic.On)
            .on('get', function (callback) {
                var character = this;
                callback(null, false);
            })
            .on('set', function (value, callback) {
                if (value) {
                    platform.api.rebootHub().then(function (resp) { callback(null); }).catch(function (err) { callback(err); });
                }
            });
        platform.addAttributeUsage('reboot', device.deviceid, thisCharacteristic);
    }


    // TODO JOEL
    // https://github.com/grzegorz914/homebridge-xbox-tv/blob/3123a3ec4898b29fd0864e157576df90d8397e5f/index.js
    if (deviceHasAttributeCommand('mediaInputSource', 'setInputSource') && that.device.attributes.hasOwnProperty('supportedInputs')) {
        that.deviceGroup = "television";

        var inputCsv = that.device.attributes['supportedInputs'];
        const inputs = inputCsv.split(',');

        var televisionService = that.getaddService(Service.Television, device.name, 'Television');

        televisionService.setCharacteristic(Characteristic.ConfiguredName, device.name)
        televisionService.setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);
        televisionService.setCharacteristic(Characteristic.ActiveIdentifier, 1);
        televisionService.setCharacteristic(Characteristic.PowerModeSelection, Characteristic.PowerModeSelection.SHOW);

        for (var i = 0; i < inputs.length; i++) {
            const inputService = that.accessory.addService(Service.InputSource, device.name + 'input' + i, device.name + 'input' + i);
            inputService.setCharacteristic(Characteristic.ConfiguredName, inputs[i]);
            inputService.setCharacteristic(Characteristic.Identifier, i + 1);
            inputService.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.HDMI);
            inputService.setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED);
            inputService.setCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.SHOWN);
            televisionService.addLinkedService(inputService);
        }

        thisCharacteristic = televisionService.getCharacteristic(Characteristic.ActiveIdentifier)
            .on('get', function (callback) {
                var mediaInputSource = that.device.attributes['mediaInputSource'];
                //platform.log('Get mediaInputSource: ' + mediaInputSource);
                callback(null, mediaInputSource);
            })
            .on('set', function (value, callback) {
                //platform.log('Set mediaInputSource: ' + value);
                platform.api.runCommand(device.deviceid, "setInputSource", {
                    value1: value
                }).then(function (resp) { if (callback) callback(null); }).catch(function (err) { if (callback) callback(err); });

            });
        platform.addAttributeUsage('mediaInputSource', device.deviceid, thisCharacteristic);


        function delay(t, v) {
            return new Promise(resolve => setTimeout(resolve, t, v));
        }

        thisCharacteristic = televisionService.getCharacteristic(Characteristic.Active)
            .on('get', function (callback) {
                var switchValue = that.device.attributes['switch'];
                // platform.log('Get switch: ' + switchValue)
                var activeValue = switchValue == 'on' ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE;
                callback(null, activeValue);
            })
            .on('set', function (value, callback) {
                //platform.log('Set switch: ' + value);
                if (value == Characteristic.Active.ACTIVE) {
                    platform.api.runCommand(device.deviceid, 'on');
                    if (callback) { callback(null); }
                }
                else {
                    platform.api.runCommand(device.deviceid, 'off'); //.then(function () { platform.log('start delay'); return delay(2000); }).then(function (resp) { platform.log('end delay'); if (callback) callback(null); }).catch(function (err) { if (callback) callback(err); });
                    if (callback) { callback(null); }
                }
            });
        platform.addAttributeUsage('switch', device.deviceid, thisCharacteristic);

        televisionService.setPrimaryService(true);
    }
}

function updateAttributes(data, platform, myObject) {
    var that = this;
    //platform.log('updateAttributes', data, that);
    for (var key in that.device.attributes) {
        if (that.device.attributes.hasOwnProperty(key)) {
            if (data.attributes.hasOwnProperty(key)) {
                //platform.log('Key ' + key + ' ' + that.device.attributes[key]);
                that.device.attributes[key] = data.attributes[key];
            }
        }

    }
    //that.device.attributes = data.attributes;
    for (var i = 0; i < that.accessory.services.length; i++) {
        for (var j = 0; j < that.accessory.services[i].characteristics.length; j++) {
            that.accessory.services[i].characteristics[j].getValue();
        }
    }
}

function loadData(data, myObject) {
    var that = this;
    if (myObject !== undefined) {
        that = myObject;
    }
    if (data !== undefined) {
        this.device = data;
        for (var i = 0; i < that.accessory.services.length; i++) {
            for (var j = 0; j < that.accessory.services[i].characteristics.length; j++) {
                that.accessory.services[i].characteristics[j].getValue();
            }
        }
    } else {
        this.log.debug('Fetching Device Data');
        this.platform.api.getDevice(this.deviceid, function (data) {
            if (data === undefined) {
                return;
            }
            this.device = data;
            for (var i = 0; i < that.accessory.services.length; i++) {
                for (var j = 0; j < that.accessory.services[i].characteristics.length; j++) {
                    that.accessory.services[i].characteristics[j].getValue();
                }
            }
        });
    }
}

function getServices() {
    return this.accessory.services;
}
