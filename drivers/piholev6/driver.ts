import {AutoDiscoveryProcess} from "./discovery";
import PairSession from "homey/lib/PairSession";
import {PiHoleConnection} from "./piholev6";

const Homey = require('homey');
const crypto = require("crypto");

class PiholeV6Driver extends Homey.Driver {

    async onInit() {
        this.log("PiholeV6Driver initialized");
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
                update_interval_seconds: 1
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
                update_interval_seconds: 1
            },
        };
    }
}

module.exports = PiholeV6Driver;