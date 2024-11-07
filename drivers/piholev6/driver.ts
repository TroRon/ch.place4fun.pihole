import {AutoDiscoveryProcess} from "./discovery";
import PairSession from "homey/lib/PairSession";
import {PiHoleConnection} from "./piholev6";
import {Device} from "homey";

const Homey = require('homey');
const crypto = require("crypto");

class PiholeV6Driver extends Homey.Driver {
    public domainQueryFlowTrigger = this.homey.flow.getDeviceTriggerCard("pihole_domain_query");
    public domainBlockedFlowTrigger = this.homey.flow.getDeviceTriggerCard("pihole_domain_blocked");
    public clientQueryFlowTrigger = this.homey.flow.getDeviceTriggerCard("pihole_client_query");
    public clientBlockedFlowTrigger = this.homey.flow.getDeviceTriggerCard("pihole_client_blocked");


    async onInit() {
        await this.registerTriggerCardRunListeners();
        this.log("PiholeV6Driver initialized");
    }

    /**
     * Register run listeners, which decide which trigger card should start given a provided pihole state.
     * Register run listeners only once since they are the same across all device instances, all information is in the parameters.
     * @private
     */
    private async registerTriggerCardRunListeners() {
        await this.domainQueryFlowTrigger.registerRunListener(async (args: {
            device: Device,
            domain: string,
            recordType: string
        }, state: any) => {
            try {
                return args.domain === state.domain && this.matchingRecordType(args, state);
            } catch (e) {
                // Any exception in the run listener is never logged by homey, so a try-catch is absolutely needed here!
                // Even though it is not needed now, this try-catch is in place as a reminder since this is
                // undocumented homey behaviour. You cannot stringify the args object, since it contains a homey device with
                // circular references
                this.error(e)
            }
        });

        await this.domainBlockedFlowTrigger.registerRunListener(async (args: {
            device: Device,
            domain: string,
            recordType: string
        }, state: any) => {
            return args.domain === state.domain && this.matchingRecordType(args, state);
        });


        await this.clientQueryFlowTrigger.registerRunListener(async (args: {
            device: Device,
            clientIp: string,
            recordType: string
        }, state: any) => {
            return args.clientIp === state.clientIp && this.matchingRecordType(args, state);
        });

        await this.clientBlockedFlowTrigger.registerRunListener(async (args: {
            device: Device,
            clientIp: string,
            recordType: string
        }, state: any) => {
            return args.clientIp === state.clientIp && this.matchingRecordType(args, state);
        });
    }

    private matchingRecordType(args: { recordType: string }, state: { recordType: string }) {
        return args.recordType === "*" || args.recordType === state.recordType;
    }

    async onPair(session: PairSession) {
        this.log("PiholeV6Driver onPair()");

        // default device when automatic detection fails
        let devices = [{
            name: this.homey.__("pairing.add_manually"),
            data: {
                id: 'pihole-' + crypto.randomUUID()
            },
            iconObj: {
                // Reverse-engineered from list-devices template, icons as documented do not work correctly
                url: "/app/ch.place4fun.pihole/drivers/pihole/assets/icon.svg",
            },
            settings: {
                base_url: "",
                port: 80,
                api_password: "",
                update_interval_seconds: 15
            },
        }]

        let autoDiscoveryProcess: AutoDiscoveryProcess | undefined = undefined

        session.setHandler("list_devices", async () => {
            this.log("list_devices");
            // Prevent multiple searches when navigating back and forth in the pairing process
            if (!autoDiscoveryProcess) {
                autoDiscoveryProcess = new AutoDiscoveryProcess(this.log);
                autoDiscoveryProcess.startDiscovery((ipAddress: string) => {
                    this.log("Found pihole at address " + ipAddress)
                    devices.push(this.createDeviceStub(ipAddress))
                    this.emit(devices)
                })
            }
            return devices;
        });

        session.setHandler("list_devices_selection", async (devicea) => {
            this.selectedDevice = devicea[0];
            this.log("Set selected device, name " + this.selectedDevice.name)
        });

        session.setHandler("get_selected_device", async (device) => {
            this.log("Get selected device, name " + this.selectedDevice.name)
            return this.selectedDevice;
        });

        session.setHandler("test_device", async (device) => {
            this.log("test_device, received settings: " + JSON.stringify(device.settings));
            const connection = new PiHoleConnection(device.settings.base_url, device.settings.api_password)
            if (!(await connection.hasValidBaseUrl())) {
                this.log("Test failed, invalid host")
                return this.homey.__("pairing.test_failed.invalid_host");
            }
            if (!(await connection.hasValidPassword())) {
                this.log("Test failed, invalid password")
                return this.homey.__("pairing.test_failed.invalid_key");
            }
            return "ok"
        });
    }

    createDeviceStub(ipAddress: string) {
        return {
            name: ipAddress,
            data: {
                id: 'pihole-' + crypto.randomUUID()
            },
            iconObj: {
                // Reverse-engineered from list-devices template, icons as documented do not work correctly
                url: "/app/ch.place4fun.pihole/drivers/pihole/assets/icon.svg",
            },
            settings: {
                base_url: "http://" + ipAddress,
                port: 80,
                api_password: "",
                update_interval_seconds: 15
            },
        };
    }
}

module.exports = PiholeV6Driver;