'use strict';

const { Device } = require('homey');

class MyDevice extends Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
      this.log('PiHole Device has been initialized');

      //Schreibt den Status, bei Veränderung, ins Log File
      this.registerCapabilityListener('onoff', async (value) => {
      this.log('Turned On/Off:' ,value);
      const deviceId = this.getData().id;

      //Bereitstellen der nötigen Informationen
      const instance1_url = this.homey.settings.get('Instance1_URL');
      const instance1_port = this.homey.settings.get('Instance1_PORT');
      const instance1_api = this.homey.settings.get('Instance1_API');
  
      const instance2_url = this.homey.settings.get('Instance2_URL');
      const instance2_port = this.homey.settings.get('Instance2_PORT');
      const instance2_api = this.homey.settings.get('Instance2_API');
  
      const instance3_url = this.homey.settings.get('Instance3_URL');
      const instance3_port = this.homey.settings.get('Instance3_PORT');
      const instance3_api = this.homey.settings.get('Instance3_API');

      const instance4_url = this.homey.settings.get('Instance4_URL');
      const instance4_port = this.homey.settings.get('Instance4_PORT');
      const instance4_api = this.homey.settings.get('Instance4_API');

      //Reagiert darauf, wenn das Gerät nicht erreichbar ist
      this.setUnavailable(this.homey.__('device.unavailable')).catch(this.error);

      //Erstellen Sie die URL(s) für den API-Aufruf
      const disable_url1 = `${instance1_url}:${instance1_port}/admin/api.php?disable&auth=${instance1_api}`;
      const disable_url2 = `${instance2_url}:${instance2_port}/admin/api.php?disable&auth=${instance2_api}`;
      const disable_url3 = `${instance3_url}:${instance3_port}/admin/api.php?disable&auth=${instance3_api}`;
      const disable_url4 = `${instance4_url}:${instance4_port}/admin/api.php?disable&auth=${instance4_api}`;
  
      const enable_url1 = `${instance1_url}:${instance1_port}/admin/api.php?enable&auth=${instance1_api}`;
      const enable_url2 = `${instance2_url}:${instance2_port}/admin/api.php?enable&auth=${instance2_api}`;
      const enable_url3 = `${instance3_url}:${instance3_port}/admin/api.php?enable&auth=${instance3_api}`;
      const enable_url4 = `${instance4_url}:${instance4_port}/admin/api.php?enable&auth=${instance4_api}`;

      // Abhandlung wenn Eingeschaltet
      if (value && deviceId === 'pihole-instance1') {
        this.log('Gerät PiHole Instance 1 wurde eingeschaltet');
        makeAPICall(enable_url1)
      } else if (value && deviceId === 'pihole-instance2') {
        this.log('Gerät PiHole Instance 2 wurde eingeschaltet');
        makeAPICall(enable_url2)
      } else if (value && deviceId === 'pihole-instance3') {
        this.log('Gerät PiHole Instance 3 wurde eingeschaltet');
        makeAPICall(enable_url3)
      } else if (value && deviceId === 'pihole-instance4') {
        this.log('Gerät PiHole Instance 4 wurde eingeschaltet');
        makeAPICall(enable_url4)
      // Abhandlung wenn Ausgeschaltet
      } else if (!value && deviceId === 'pihole-instance1') {
        this.log('Gerät PiHole Instance 1 wurde ausgeschaltet');
        makeAPICall(disable_url1)
      } else if (!value && deviceId === 'pihole-instance2') {
        this.log('Gerät PiHole Instance 2 wurde ausgeschaltet');
        makeAPICall(disable_url2)
      } else if (!value && deviceId === 'pihole-instanc3') {
        this.log('Gerät PiHole Instance 3 wurde ausgeschaltet');
        makeAPICall(disable_url3)
      } else if (!value && deviceId === 'pihole-instance4') {
        this.log('Gerät PiHole Instance 4 wurde ausgeschaltet');
        makeAPICall(disable_url4)
      }
     }
    )
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('PiHole Device has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('PiHole Device settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('PiHole Device was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('PiHole Device has been deleted');
  }


  async onDeleted() {
    this.log('PiHole Device has been deleted');
  }

  async onPairListDevices() {
  }
}


module.exports = MyDevice;

//Hilfs-Funktion für API Aufruf
async function makeAPICall(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    console.log('API-Aufruf erfolgreich');
    // Füge hier weitere Logik hinzu, falls gewünscht

    return { success: true }; // Erfolgsstatus zurückgeben

  } catch (error) {
    console.error('Fehler beim API-Aufruf:', error);
    return { success: false, errorMessage: error.message }; // Fehlerstatus und Fehlermeldung zurückgeben
  }
}
