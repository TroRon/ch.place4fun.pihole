import {PiHoleConnection} from "./piholev6";

export class AutoDiscoveryProcess {
    private log;

    public constructor(log: CallableFunction) {
        this.log = log;
    }

    public async startDiscovery(onDeviceFound: Function): Promise<void> {
        this.log("PiHoleV6 | Starting auto-discovery for PiHole V6 instances")
        let addresses = await this.getIpsInSubnet();
        console.log("PiHoleV6 | Testing " + addresses.length + " ip addresses...")
        addresses = ["pi.hole", "pihole.local", ...addresses] // also search two DNS names which are likely matches
        for (const address of addresses) {
            // this.homey.arp.getMAC(ipAddress) is horribly slow and unusable as help, so we have to brute-force discovery
            let isValid = (await PiHoleConnection.isPiHoleHost("http://" + address, 50));
            if (isValid) {
                onDeviceFound(address)
            }
        }

    }

    private async getIpsInSubnet(): Promise<String[]> {
        // There are better ways to do this, such as obtaining the DNS server through DHCP or getting hosts from ARP
        // Homey blocks them all :(
        // The dns server is also known in homeys dev tools, but not exposed to apps.
        // When getting DNS servers through nodejs homeys hardcoded servers are returned instead of dhcp values
        const {networkInterfaces} = require('os');
        const nets = networkInterfaces();
        let localIpAddresses = [];
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
                // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
                const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
                if (net.family === familyV4Value && !net.internal) {
                    let ips = this.getIPsInSubnet(net.address, net.netmask);
                    // Check 254 addresses at most, so we don't flood the network on large subnets
                    ips = ips.splice(0, 254)
                    localIpAddresses.push(...ips);
                }
            }
        }
        return localIpAddresses;
    }

    // Get the integer representation of the IP
    private ipToInteger(ip: string): number {
        let [a, b, c, d] = ip.split('.').map(Number);
        return (((((a << 8) + b) << 8) + c) << 8) + d;
    };

    // Get the string representation of the IP
    private integerToIP(i: number): string {
        return [(i >> 24) & 255, (i >> 16) & 255, (i >> 8) & 255, i & 255].join('.');
    };

    // Returns all IP addresses in a subnet
    private getIPsInSubnet(ip: string, mask: string): String[] {
        const baseIPInteger = this.ipToInteger(ip);
        const maskInteger = this.ipToInteger(mask);
        let startIPInteger = baseIPInteger & maskInteger;
        let endIPInteger = startIPInteger | ~maskInteger;

        let addressesInSubnet = [];
        for (let i = startIPInteger; i <= endIPInteger; i++) {
            if ((i & 255) === 255 || (i & 255) === 0) {
                // skip broadcast address .255 and .0
                continue
            }
            addressesInSubnet.push(this.integerToIP(i));
        }

        return addressesInSubnet;
    };
}