'use strict';

const { Driver } = require('homey');

class PiHoleDriver extends Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('PiHole Driver has been initialized');
    super.onInit();
    this.capabilities = [
        'status-pihole'        
    ]
  }

  /**
   * onPairListDevices is called when a user is adding a device
   * and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    const devices = [];

    const apiKeyInstance1 = await this.homey.settings.get('Instance1_API');
    const apiKeyInstance2 = await this.homey.settings.get('Instance2_API');
    const apiKeyInstance3 = await this.homey.settings.get('Instance3_API');
    const apiKeyInstance4 = await this.homey.settings.get('Instance4_API');

    if (apiKeyInstance1) {
      devices.push(
        // Gerät wird nur angezeigt, wenn auch ein API Key erfasst wurde
        {
          name: 'Instanz 1',
          data: {
            id: 'pihole-instance1',
          },
        },
      );
    }

    if (apiKeyInstance2) {
      devices.push(
      // Gerät wird nur angezeigt, wenn auch ein API Key erfasst wurde      
        {    
      name:'Instanz 2',
          data: {
            id: 'pihole-instance2',
          },
        },
      );
    }


    if (apiKeyInstance3) {
      devices.push(
      // Gerät wird nur angezeigt, wenn auch ein API Key erfasst wurde
        {
          name: 'Instanz 3',
          data: {
            id: 'pihole-instance3',
          },
        },
      );
    }

    if (apiKeyInstance4) {
      devices.push(
// Gerät wird nur angezeigt, wenn auch ein API Key erfasst wurde
        {
          name: 'Instanz 4',
          data: {
            id: 'pihole-instance4',
          },
        },
      );
    }
    return devices;
  }
}
module.exports = PiHoleDriver;

