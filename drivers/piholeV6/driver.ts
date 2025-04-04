import {AutoDiscoveryProcess} from "./discovery";
import PairSession from "homey/lib/PairSession";
import {BlockingStatus, Pihole6Group, PiHoleConnection} from "./piholev6";
import {PiHoleV6Device} from './device';
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
        this.registerFlowActionListeners();
        this.registerFlowConditionListeners();
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

        // Backwards compatibility for pre-12.2 devices. Once the app compatibility level is increased to 12.2, this custom capability can be replaced by the native one
        this.homey.flow.getDeviceTriggerCard('alarm_connectivity_false').registerRunListener((args: any, state: any) => {
            return args.device.getCapabilityValue('alarm_connectivity') === args.state;
        });

        this.homey.flow.getDeviceTriggerCard('alarm_connectivity_true').registerRunListener((args: any, state: any) => {
            return args.device.getCapabilityValue('alarm_connectivity') === args.state;
        });
    }

    private matchingRecordType(args: { recordType: string }, state: { recordType: string }) {
        return args.recordType === "*" || args.recordType === state.recordType;
    }

    private registerFlowActionListeners() {

        const EnableBlockingAction = this.homey.flow.getActionCard('on');
        EnableBlockingAction.registerRunListener(async (args: any, state: any) => {
            // The arguments contain the device on which the card was executed
            await this.requirePiholeConnection(args).setBlockingState(true);
            args.device.refresh() // immediately refresh data to ensure the UI is updated with the results of this action
        });

        const DisableBlockingAction = this.homey.flow.getActionCard('off');
        DisableBlockingAction.registerRunListener(async (args: any, state: any) => {
            // The arguments contain the device on which the card was executed
            await this.requirePiholeConnection(args).setBlockingState(false);
            args.device.refresh() // immediately refresh data to ensure the UI is updated with the results of this action
        });


        const pauseBlockingAction = this.homey.flow.getActionCard('pihole_pause');
        pauseBlockingAction.registerRunListener(async (args: any, state: any) => {
            // The arguments contain the device on which the card was executed
            let durationSeconds = args.duration;
            await this.requirePiholeConnection(args).setBlockingState(false, durationSeconds);
            args.device.refresh() // immediately refresh data to ensure the UI is updated with the results of this action
        });

        const restartPiHoleDnsAction = this.homey.flow.getActionCard('pihole_restart_dns');
        restartPiHoleDnsAction.registerRunListener(async (args: any, state: any) => {
            // The arguments contain the device on which the card was executed
            await this.requirePiholeConnection(args).restartDns();
            args.device.refresh() // immediately refresh data to ensure the UI is updated with the results of this action
        });

        const updateGravityAction = this.homey.flow.getActionCard('pihole_update_gravity');
        updateGravityAction.registerRunListener(async (args: any, state: any) => {
            // The arguments contain the device on which the card was executed
            await this.requirePiholeConnection(args).updateGravity();
            args.device.refresh() // immediately refresh data to ensure the UI is updated with the results of this action
        });

        const refreshAction = this.homey.flow.getActionCard('pihole_refresh');
        refreshAction.registerRunListener(async (args: any, state: any) => {
            // The arguments contain the device on which the card was executed
            args.device.refresh()
        });

        const addDomainAction = this.homey.flow.getActionCard('pihole_domain_add');
        addDomainAction.registerRunListener(async (args: any, state: any) => {
            // The arguments contain the device on which the card was executed
            await this.requirePiholeConnection(args).addDomain(args.domain, "exact", args.allowedOrBlocked).then(
                response => {
                    if (response.processed.errors.length) throw new Error(response.processed.errors[0].error);
                }
            );
        });

        const addRegexDomainAction = this.homey.flow.getActionCard('pihole_domain_add_regex');
        addRegexDomainAction.registerRunListener(async (args: any, state: any) => {
            // The arguments contain the device on which the card was executed
            await this.requirePiholeConnection(args).addDomain(args.domain, "regex", args.allowedOrBlocked).then(
                response => {
                    if (response.processed.errors.length) throw new Error(response.processed.errors[0].error);
                }
            );
        });

        const removeDomainAction = this.homey.flow.getActionCard('pihole_domain_remove');
        removeDomainAction.registerRunListener(async (args: any, state: any) => {
            await this.requirePiholeConnection(args).removeDomain(args.domain, "exact", args.allowedOrBlocked);
        });

        const removeRegexDomainAction = this.homey.flow.getActionCard('pihole_domain_remove_regex');
        removeRegexDomainAction.registerRunListener(async (args: any, state: any) => {
            await this.requirePiholeConnection(args).removeDomain(args.domain, "regex", args.allowedOrBlocked);
        });

        const addDomainToGroupAction = this.homey.flow.getActionCard('pihole_group_add_domain');
        addDomainToGroupAction.registerArgumentAutocompleteListener("group", this.autocompletePiholeGroups);
        addDomainToGroupAction.registerRunListener(async (args: any, state: any) => {
            await this.requirePiholeConnection(args).addDomainToGroup(args.domain, args.group.id);
        });

        const removeDomainFromGroupAction = this.homey.flow.getActionCard('pihole_group_remove_domain');
        removeDomainFromGroupAction.registerArgumentAutocompleteListener("group", this.autocompletePiholeGroups);
        removeDomainFromGroupAction.registerRunListener(async (args: any, state: any) => {
            await this.requirePiholeConnection(args).removeDomainFromGroup(args.domain, args.group.id);
        });

        const addLocalDnsRecordAction = this.homey.flow.getActionCard('pihole_local_dns_add_record');
        addLocalDnsRecordAction.registerRunListener(async (args: any, state: any) => {
            await this.requirePiholeConnection(args).addLocalDnsRecord(args.domain, args.ip);
        });

        const removeLocalDnsRecordAction = this.homey.flow.getActionCard('pihole_local_dns_remove_record');
        removeLocalDnsRecordAction.registerRunListener(async (args: any, state: any) => {
            await this.requirePiholeConnection(args).removeLocalDnsRecord(args.domain);
        });
    }

    private async autocompletePiholeGroups(query: string, args: any): Promise<any> {
        if (!args.device.piHoleConnection) {
            throw new Error("Not connected to Pi-Hole")
        }
        const piholeGroups = await args.device.piHoleConnection.listGroups();
        return piholeGroups
            .filter((group: Pihole6Group) => group.name.toLowerCase().includes(query.toLowerCase()))
            .map((group: Pihole6Group) => {
                return {
                    name: group.name,
                    description: group.comment,
                    id: group.id
                }
            })
    }

    private registerFlowConditionListeners() {
        const ruleExistsCondition = this.homey.flow.getConditionCard('pihole_rule_exists');
        ruleExistsCondition.registerRunListener(async (args: any, state: any) => {
            return await this.requirePiholeConnection(args).getDomainDetails(args.domain, args.allowedOrBlocked).then(
                domains => domains.filter(domain => domain.enabled).length > 0
            );
        });

        const domainBlockedCondition = this.homey.flow.getConditionCard('pihole_domain_blocked');
        domainBlockedCondition.registerRunListener(async (args: any, state: any) => {
            return await this.requirePiholeConnection(args).searchDomain(args.domain).then(
                domains => {
                    this.log(JSON.stringify(domains))
                    const isWhiteListed = domains.filter(domain => domain.enabled && domain.kind != "gravity" && domain.type == "allow").length > 0
                    const isBlocklistBlocked = domains.filter(domain => domain.enabled && domain.kind == "gravity" && domain.type == "deny").length > 0
                    const isCustomBlocked = domains.filter(domain => domain.enabled && domain.kind != "gravity" && domain.type == "deny").length > 0
                    if (isBlocklistBlocked && isCustomBlocked) {
                        throw new Error("Domain is both blocked and allowed by different rules, cannot determine correct answer!")
                    }
                    if (isWhiteListed) {
                        return false;
                    }
                    return isBlocklistBlocked || isCustomBlocked;
                }
            );
        });

        this.homey.flow.getConditionCard('alarm_connectivity').registerRunListener( (args: any, state: any) => {
            return args.device.getCapabilityValue('alarm_connectivity');
        });
    }

    private requirePiholeConnection(args: { device: PiHoleV6Device }): PiHoleConnection {
        let connection = args.device.getConnection();
        if (!connection) {
            throw new Error("Not connected to Pi-Hole, cannot apply action!")
        }
        return connection
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
                url: "/app/ch.place4fun.pihole/drivers/piholeV6/assets/icon.svg",
            },
            settings: {
                base_url: "",
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
                autoDiscoveryProcess.startDiscovery((address: string) => {
                    this.log("Found pihole at address " + address)
                    devices.push(this.createDeviceStub(address))
                    session.emit("list_devices", devices)
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

    createDeviceStub(address: string) {
        return {
            name: address,
            data: {
                id: 'pihole-' + crypto.randomUUID()
            },
            iconObj: {
                // Reverse-engineered from list-devices template, icons as documented do not work correctly
                url: "/app/ch.place4fun.pihole/drivers/piholeV6/assets/icon.svg",
            },
            settings: {
                base_url: "http://" + address,
                api_password: "",
                update_interval_seconds: 15
            },
        };
    }
}

module.exports = PiholeV6Driver;