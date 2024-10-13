const Homey = require('homey');
const crypto = require("crypto");
const net = require("net");

class PiholeDriver extends Homey.Driver {
  async onInit() {
    this.log("PiholeDriver initialized");
  }

  async onPair(session) {
    this.log("onPair()");

    // default device when automatic detection fails
    let devices = [{
      name: this.homey.__("pairing.add_manually"),
      data: {
        id: 'pihole-' + crypto.randomUUID()
      },
      settings: {
        url: "",
        port: 80,
        api: "",
        interval: 1
      },
    }]

    session.setHandler("list_devices", async () => {
      this.log("list_devices");
      // Automatic detection of DNS servers
      this.emitAutodetectedPiHoles(session, devices);
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
      this.log("test_device, received settings: " + device.settings);
      if ((await this.valid_host(device.settings.url, device.settings.port)) === false) {
        return this.homey.__("pairing.test_failed.invalid_host");
      }
      if ((await this.valid_key(device)) === false) {
        return this.homey.__("pairing.test_failed.invalid_key");
      }
      return "ok"
    });
  }

  createDeviceStub(ipAddress) {
    return {
      name: ipAddress,
      data: {
        id: 'pihole-' + crypto.randomUUID()
      },
      icon: "/icon.svg",
      settings: {
        url: "http://" + ipAddress,
        port: 80,
        api: "",
        interval: 1
      },
    };
  }

  async valid_host(url, port, timeout = 5_000) {
    let versionUrl = url + ":" + port + "/admin/api.php?versions";
    return fetch(versionUrl, {
      signal: AbortSignal.timeout(timeout),
    })
      .then(response => {
        this.log("Response " + response.status)
        return response.json()
      })
      .then(json => json["FTL_update"] !== undefined)
      .catch(e => {
        // this.log("Failed to get a valid response: " + e)
        return false;
      });
  }


  async valid_key(device) {
    try {
      // This page always returns HTTP 200, but with an invalid key it returns an empty array instead of an object
      let summaryUrl = device.settings.url + ":" + device.settings.port
        + "/admin/api.php?summaryRaw&auth=" + device.settings.api;
      this.log("Testing key through " + summaryUrl)
      return await fetch(summaryUrl)
        .then(response => response.json())
        .then(json => !Array.isArray(json))
    } catch (e) {
      this.log("Failed to get a valid response: " + e)
      return false;
    }
  }


  async getIpsInSubnet() {
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

  async emitAutodetectedPiHoles(session, devices) {
    return new Promise(async (resolve, reject) => {
      let addresses = await this.getIpsInSubnet();
      let result = [];
      this.log("Testing " + addresses.length + " ip addresses...")
      for (const ipAddress of addresses) {
        // this.homey.arp.getMAC(ipAddress) is horribly slow and unusable as help, so we have to brute-force discovery
        let isValid = (await this.valid_host("http://" + ipAddress, 80, 50));
        if (isValid) {
          devices.push(this.createDeviceStub(ipAddress));
          session.emit("list_devices", devices); // emit while discovering for faster feedback in the UI
        }
      }
      resolve(result);
    });
  }


// Get the integer representation of the IP
  ipToInteger(ip) {
    let [a, b, c, d] = ip.split('.').map(Number);
    return (((((a << 8) + b) << 8) + c) << 8) + d;
  };

// Get the string representation of the IP
  integerToIP(i) {
    return [(i >> 24) & 255, (i >> 16) & 255, (i >> 8) & 255, i & 255].join('.');
  };

// Returns all IP addresses in a subnet
  getIPsInSubnet(ip, mask) {
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

module.exports = PiholeDriver;