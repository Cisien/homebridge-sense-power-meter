'use strict';
import { Service, Characteristic, CharacteristicGetCallback, Logger, API, AccessoryConfig } from 'homebridge';
import { ACCESSORY_NAME } from './settings';
import senseEnergyNode from 'sense-energy-node';

class SenseAccessoryOptions {
    public username!: string;
    public password!: string;
    public name!: string;
    public pollingInterval!: number;
    public verbose!: boolean;
}

class SenseResponse {
    public type!: string;
    public payload!: SensePayload
}
class SensePayload {
    public voltage!: number[];
    public w!: number;
    public c!: number;
}

export class SensePowerMeterAccessory {
    public readonly api: API;
    public readonly log: Logger;
    public readonly options: SenseAccessoryOptions;

    public readonly Service: typeof Service;
    public readonly Characteristic: typeof Characteristic;

    private voltage: number;
    private current: number;
    private watts: number;

    private service: Service;

    constructor(log: Logger, config: AccessoryConfig, api: API) {
        this.api = api;
        this.log = log;
        this.Service = api.hap.Service;
        this.Characteristic = api.hap.Characteristic;

        this.options = {
            username: config.username,
            password: config.password,
            name: config.name || ACCESSORY_NAME,
            pollingInterval: config.pollingInterval || 60,
            verbose: config.verbose || false,
        };

        this.voltage = 0;
        this.current = 0;
        this.watts = 0;

        this.service = new this.Service.LightSensor(this.options.name);
        this.service.getCharacteristic(this.Characteristic.CurrentAmbientLightLevel).on('get', this.getWatts.bind(this));

        this.startSense();
    }

    private async startSense() {        
        const client = await senseEnergyNode({
            email: encodeURI(this.options.username),
            password: encodeURI(this.options.password),
            verbose: this.options.verbose,
        });

        const refreshAuth = () => {
            try {
                client.getAuth();
            } catch (error) {
                this.log.error(`Re-auth failed: ${error}.`);
            }
        };

        client.openStream();

        client.events.on('data', (data: SenseResponse) => {

            if (data.type !== 'realtime_update' || !data.payload) {
                return 0;
            }

            let volts = 0;
            for (const channel of data.payload.voltage) {
                volts += channel;
            }

            volts = volts / data.payload.voltage.length;

            this.voltage = volts;

            this.watts = data.payload.w;
            this.current = data.payload.c;
            this.log.info(`Received data. Watts: ${this.watts}, Current: ${this.current}, Voltage: ${this.voltage}`);
            client.closeStream();
        });

        client.events.on('error', (err: object) => {
            this.log.error('Error event on sense:', err);
        });

        client.events.on('close', (data: { wasClean: boolean; reason: string }) => {
            this.log.debug(`Sense WebSocket Closed | Reason: ${data.wasClean ? 'Normal' : data.reason}`);
            let interval = this.options.pollingInterval && this.options.pollingInterval > 10 ? this.options.pollingInterval : 60;
            interval = interval * 1000;

            this.log.debug(`New poll scheduled for ${interval} ms from now.`);
            setTimeout(() => {
                refreshAuth();
                client.openStream();
            }, interval);
        });
    }

    private getWatts(callback: CharacteristicGetCallback) {
        this.log.debug(`get watts called, returning ${this.watts}`);
        callback(null, this.watts);
    }

    public getServices() {
        return [this.service];
    }
}