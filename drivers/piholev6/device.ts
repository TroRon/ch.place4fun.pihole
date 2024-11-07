import {BlockingStatus, PiHoleConnection} from './piholev6';
import {clearInterval} from "node:timers";

const Homey = require('homey');

class PiHoleV6Device extends Homey.Device {

    private static readonly FLOW_TRIGGER_UPDATE_INTERVAL_SECONDS = 2;

    // The interval for updating the homey device, always active. Interval defined by device settings
    private generalUpdateIntervalId: NodeJS.Timeout | undefined = undefined
    // The interval for updating flow trigger cards, only active when flow trigger cards are in use
    private flowTriggerUpdateIntervalId: NodeJS.Timeout | undefined = undefined

    // The Pi-Hole API connection
    private piHoleConnection: PiHoleConnection | undefined = undefined

    // Cached trigger card parameter values, so we can use these to quickly filter through the queries list if
    // trigger cards are used
    private domainBlockedTriggerArgs: any[] = [];
    private domainQueriedTriggerArgs: any[] = [];
    private clientQueriedTriggerArgs: any[] = [];
    private clientBlockedTriggerArgs: any[] = [];

    async onInit() {
        this.log('Initializing PiHole v6 device');

        // Update and register capabilities
        this.updateCapabilities();
        this.registerCapabilityListeners();

        // Connect to pihole
        const deviceSettings = this.getSettings();
        if (deviceSettings) {
            this.piHoleConnection = new PiHoleConnection(deviceSettings.base_url, deviceSettings.api_password)
            const update_interval_seconds = deviceSettings.update_interval_seconds
            this.setUpdateInterval(update_interval_seconds)
        }

        // Register trigger cards and action cards
        this.registerFlowTriggerListeners();
        this.registerFlowActionListeners();

        this.log('Initialized PiHole v6 device');
    }

    private registerCapabilityListeners() {
        // Blocking on/off toggle
        this.registerCapabilityListener('onoff', async (value: boolean) => {
            this.log('onoff value changed to ', value);
            if (this.piHoleConnection) {
                let result = await this.piHoleConnection.setBlockingState(value)
                // immediately update onoff capability
                await this.setCapabilityValue("onoff", result.blocking == BlockingStatus.Enabled)
                this.refresh() // immediately refresh data to ensure the UI is updated with the results of this action
            }
        })

        this.registerCapabilityListener('data_refresh', async () => {
            await this.refresh() // immediately refresh data to ensure the UI is updated with the results of this action
        })

        this.registerCapabilityListener('pihole_restart_dns', async () => {
            if (this.piHoleConnection) {
                await this.piHoleConnection.restartDns();
                this.refresh() // immediately refresh data to ensure the UI is updated with the results of this action
            }
        })

        this.registerCapabilityListener('pihole_update_gravity', async () => {
            if (this.piHoleConnection) {
                await this.piHoleConnection.updateGravity();
                this.refresh() // immediately refresh data to ensure the UI is updated with the results of this action
            }
        })
    }

    private registerFlowActionListeners() {
        const pauseBlockingAction = this.homey.flow.getActionCard('pihole_pause');
        pauseBlockingAction.registerRunListener(async (args: any, state: any) => {
            if (!this.piHoleConnection) {
                return
            }
            let durationMilliSeconds = args.duration;
            await this.piHoleConnection.setBlockingState(false, durationMilliSeconds / 1000);
            this.refresh() // immediately refresh data to ensure the UI is updated with the results of this action
        });

        const restartPiHoleDnsAction = this.homey.flow.getActionCard('pihole_restart_dns');
        restartPiHoleDnsAction.registerRunListener(async (args: any, state: any) => {
            if (!this.piHoleConnection) {
                return
            }
            await this.piHoleConnection.restartDns();
            this.refresh() // immediately refresh data to ensure the UI is updated with the results of this action
        });

        const updateGravityAction = this.homey.flow.getActionCard('pihole_update_gravity');
        updateGravityAction.registerRunListener(async (args: any, state: any) => {
            if (!this.piHoleConnection) {
                return
            }
            await this.piHoleConnection.updateGravity();
            this.refresh() // immediately refresh data to ensure the UI is updated with the results of this action
        });
    }

    private registerFlowTriggerListeners() {
        // Get the current trigger card arguments, and update the argument lists when a change is made
        this.log("Registering trigger card argument listeners")

        this.registerdomainQueryFlowTrigger()
        this.driver.domainQueryFlowTrigger.addListener("update", () => this.registerdomainQueryFlowTrigger());

        this.registerDomainBlockedFlowTrigger()
        this.driver.domainBlockedFlowTrigger.addListener("update", () => this.registerDomainBlockedFlowTrigger());

        this.registerclientQueryFlowTrigger()
        this.driver.clientQueryFlowTrigger.addListener("update", () => this.registerclientQueryFlowTrigger());

        this.registerClientBlockedFlowTrigger()
        this.driver.clientBlockedFlowTrigger.addListener("update", () => this.registerClientBlockedFlowTrigger());
    }

    registerdomainQueryFlowTrigger() {
        this.driver.domainQueryFlowTrigger.getArgumentValues(this).then((args: [{ domain: string }]) => {
            this.domainQueriedTriggerArgs = args.map(a => a.domain);
            if (this.domainQueriedTriggerArgs.length > 0) {
                this.startTriggerCheckInterval();
            }
            this.pauseTriggerCheckIntervalIfNeeded();
        });
    }

    registerDomainBlockedFlowTrigger() {
        this.driver.domainBlockedFlowTrigger.getArgumentValues(this).then((args: [{ domain: string }]) => {
            this.domainBlockedTriggerArgs = args.map(a => a.domain);
            if (this.domainBlockedTriggerArgs.length > 0) {
                this.startTriggerCheckInterval();
            }
            this.pauseTriggerCheckIntervalIfNeeded();
        });
    }

    registerclientQueryFlowTrigger() {
        this.driver.clientQueryFlowTrigger.getArgumentValues(this).then((args: [{ clientIp: string }]) => {
            this.clientQueriedTriggerArgs = args.map(a => a.clientIp);
            if (this.clientQueriedTriggerArgs.length > 0) {
                this.startTriggerCheckInterval();
            }
            this.pauseTriggerCheckIntervalIfNeeded();
        });
    }

    registerClientBlockedFlowTrigger() {
        this.driver.clientBlockedFlowTrigger.getArgumentValues(this).then((args: [{ clientIp: string }]) => {
            this.clientBlockedTriggerArgs = args.map(a => a.clientIp);
            if (this.clientBlockedTriggerArgs.length > 0) {
                this.startTriggerCheckInterval();
            }
            this.pauseTriggerCheckIntervalIfNeeded();
        });
    }

    private startTriggerCheckInterval() {
        if (this.flowTriggerUpdateIntervalId == undefined) {
            this.log("Starting flow trigger check")
            let intervalMs = PiHoleV6Device.FLOW_TRIGGER_UPDATE_INTERVAL_SECONDS * 1000;
            this.flowTriggerUpdateIntervalId = this.homey.setInterval(this.checkTriggers.bind(this), intervalMs)
        }
    }

    private pauseTriggerCheckIntervalIfNeeded() {
        let anyQueryTriggerCardInUse = this.domainBlockedTriggerArgs.length == 0
            && this.domainQueriedTriggerArgs.length == 0
            && this.clientBlockedTriggerArgs.length == 0
            && this.clientQueriedTriggerArgs.length == 0;
        if (anyQueryTriggerCardInUse && this.flowTriggerUpdateIntervalId != undefined) {
            this.log("Stopping flow trigger check, no registered flow cards")
            this.homey.clearInterval(this.flowTriggerUpdateIntervalId)
            this.flowTriggerUpdateIntervalId = undefined
        }
    }

    async checkTriggers() {
        // this.log("Checking trigger cards based on queries in the past " + PiHoleV6Device.FLOW_TRIGGER_UPDATE_INTERVAL_SECONDS + " seconds")
        let recentQueries = await this.piHoleConnection?.getRecentQueries(PiHoleV6Device.FLOW_TRIGGER_UPDATE_INTERVAL_SECONDS);

        // We don't want to trigger the same domain twice in one loop. Therefore, 
        // the combination of domain + record + client should be unique within each trigger card type
        let domainQueriedTriggers: string[] = [];
        let domainBlockedTriggers: string[] = [];
        let clientQueriedTriggers: string[] = [];
        let clientBlockedTriggers: string[] = [];

        function getQueryIdentifier(query: any) {
            return query.type + "::" + query.client.ip + "::" + query.domain;
        }

        if (recentQueries != undefined) {
            for (const query of recentQueries.queries) {
                this.log(JSON.stringify(query));

                // the domain state object for domain-based trigger cards
                let domainstate = {
                    domain: query.domain,
                    recordType: query.type
                };

                // the client ip state for client-based trigger cards
                let clientIpState = {
                    clientIp: query.client.ip,
                    recordType: query.type
                };

                if (this.domainQueriedTriggerArgs.includes(query.domain)) {
                    let id = getQueryIdentifier(query);
                    if (!domainQueriedTriggers.includes(id)) {
                        this.driver.domainQueryFlowTrigger.trigger(this, this.getQueryTriggerTokens(query), domainstate);
                        domainQueriedTriggers.push(id)
                    }
                }

                if (this.clientQueriedTriggerArgs.includes(query.client.ip)) {
                    let id = getQueryIdentifier(query);
                    if (!clientQueriedTriggers.includes(id)) {
                        this.driver.clientQueryFlowTrigger.trigger(this, this.getQueryTriggerTokens(query), clientIpState);
                        clientQueriedTriggers.push(id)
                    }
                }

                if (this.domainBlockedTriggerArgs.includes(query.domain) && query.status == "DENYLIST") {
                    let id = getQueryIdentifier(query);
                    if (!domainBlockedTriggers.includes(id)) {
                        this.driver.domainBlockedFlowTrigger.trigger(this, this.getQueryTriggerTokens(query), domainstate);
                        domainBlockedTriggers.push(id)
                    }
                }

                if (this.clientBlockedTriggerArgs.includes(query.client.ip) && query.status == "DENYLIST") {
                    let id = getQueryIdentifier(query);
                    if (!clientBlockedTriggers.includes(id)) {
                        this.driver.clientBlockedFlowTrigger.trigger(this, this.getQueryTriggerTokens(query), clientIpState);
                        clientBlockedTriggers.push(id)
                    }
                }
            }
        }
    }

    private getQueryTriggerTokens(query: any) {
        // The object containing all tokens, which are the same for all trigger cards reacting to queries
        return {
            queryStatus: query.status,
            // round duration to 2 decimals
            queryDuration: query.reply.time > 0 ? Math.round(query.reply.time * 100) / 100 : -1,
            domain: query.domain,
            recordType: query.type,
            clientIp: query.client.ip,
            clientName: query.client.name == null ? "" : query.client.name
        };
    }

    /**
     * onAdded is called when the user adds the device, called just after pairing.
     */
    async onAdded() {
        this.log('PiHoleV6Device device added');
    }

    /**
     * onSettings is called when the user updates the device's settings.
     * @param {object} event the onSettings event data
     * @param {object} event.oldSettings The old settings object
     * @param {object} event.newSettings The new settings object
     * @param {string[]} event.changedKeys An array of keys changed since the previous version
     * @returns {Promise<string|void>} return a custom message that will be displayed
     */
    // @ts-ignore
    async onSettings({oldSettings, newSettings, changedKeys}) {
        if (changedKeys.includes('base_url') || changedKeys.includes('api_password')) {
            this.piholeDevice = new PiHoleConnection(newSettings.base_url, newSettings.api_password)
        }
        if (changedKeys.includes('update_interval_seconds')) {
            this.setUpdateInterval(newSettings.update_interval_seconds);
        }
    }

    /**
     * onRenamed is called when the user updates the device's name.
     * This method can be used this to synchronise the name to the device.
     * @param {string} name The new name
     */
    async onRenamed(name: string) {
        this.log('PiHoleV6Device renamed to ' + name);
    }

    /**
     * onDeleted is called when the user deleted the device.
     */
    async onDeleted() {
        if (this.generalUpdateIntervalId) {
            clearInterval(this.generalUpdateIntervalId)
        }
        if (this.flowTriggerUpdateIntervalId) {
            clearInterval(this.flowTriggerUpdateIntervalId)
        }
        if (this.piHoleConnection) {
            this.piHoleConnection.closeConnectionLogout();
        }
    }

    async updateCapabilities() {
        let capabilities = [];
        try {
            capabilities = this.homey.app.manifest.drivers.filter((e: any) => {
                return (e.id == this.driver.id);
            })[0].capabilities;
            // remove capabilities
            let deviceCapabilities = this.getCapabilities();
            for (let i = 0; i < deviceCapabilities.length; i++) {
                let filter = capabilities.filter((e: any) => {
                    return (e == deviceCapabilities[i]);
                });
                if (filter.length == 0) {
                    try {
                        await this.removeCapability(deviceCapabilities[i]);
                    } catch (error) {
                    }
                }
            }
            // add missing capabilities
            for (let i = 0; i < capabilities.length; i++) {
                if (!this.hasCapability(capabilities[i])) {
                    try {
                        await this.addCapability(capabilities[i]);
                    } catch (error) {
                    }
                }
            }
        } catch (error: any) {
            this.error(error.message);
        }
    }

    setUpdateInterval(updateIntervalSeconds: number) {
        if (this.generalUpdateIntervalId) {
            // If there is an existing interval, cancel it
            clearInterval(this.generalUpdateIntervalId)
        }
        // create the new interval
        this.generalUpdateIntervalId = setInterval(this.refresh.bind(this), updateIntervalSeconds * 1000);
        this.refresh()
    }


    async refresh() {
        if (!this.piHoleConnection) {
            this.log("Cannot refresh, not connected!")
            return
        }
        try {
            // Get all statistics
            let statistics = await this.piHoleConnection.getAllInfo();
            // Update capabilities
            this.setCapabilityValue('onoff', statistics.blocking == BlockingStatus.Enabled);
            this.setCapabilityValue('blocking_state', statistics.blocking);
            this.setCapabilityValue('measure_active_client_count', statistics.active_clients);
            this.setCapabilityValue('measure_queries_total_24h', statistics.queries.total);
            this.setCapabilityValue('measure_queries_blocked_24h', statistics.queries.blocked);
            this.setCapabilityValue('measure_queries_blocked_relative_24h', statistics.queries.percent_blocked);
            this.setCapabilityValue('measure_relative_cpu_usage', statistics["%cpu"]);
            this.setCapabilityValue('measure_relative_memory_usage', statistics["%mem"]);
            this.setCapabilityValue('measure_cpu_temp', statistics.sensors.cpu_temp);
            this.setCapabilityValue('measure_system_uptime_seconds', statistics.system.uptime);
            this.setCapabilityValue('core_update_available', statistics.version.core.local.version != statistics.version.core.remote.version);
            this.setCapabilityValue('ftl_update_available', statistics.version.ftl.local.version != statistics.version.ftl.remote.version);
            this.setCapabilityValue('web_update_available', statistics.version.web.local.version != statistics.version.web.remote.version);
            this.setCapabilityValue('alarm_communication_error', false);
            this.setAvailable() // mark device as available in homey
        } catch (e) {
            this.setCapabilityValue('alarm_communication_error', true);
            this.setUnavailable(e) // mark device as unavailable
        }
    }
}

module.exports = PiHoleV6Device;