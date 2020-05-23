'use strict';
import { API } from 'homebridge';
import { PLUGIN_NAME, ACCESSORY_NAME } from './settings';
import { SensePowerMeterAccessory } from './senseAccessory';

export = (homebridge: API) => {
    homebridge.registerAccessory(PLUGIN_NAME, ACCESSORY_NAME, SensePowerMeterAccessory);
};