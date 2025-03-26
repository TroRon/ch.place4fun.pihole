// @ts-nocheck
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();
const Homey = require('homey');

class PiHoleControl extends Homey.App {
  async onInit() {
  //Schreibe ins Log
  this.log(`${Homey.manifest.id}-${Homey.manifest.version}-Initialization ....`);

  //Schreibe eine Meldung in die Time-Line wegen altem Treiber-Modell
  //this.homey.notifications.createNotification({excerpt: this.homey.__('warnings.deprecated1')}).catch(error => {this.error('Error sending notification: '+error.message)});

  //Aktions-Karten
  //pihole-disable-piholes.json
  const disablePiholes = this.homey.flow.getActionCard('pihole-disable-piholes');
      disablePiholes.registerRunListener(async (args, state) => {
      return await this.disablePiholes(args, state);
  });

  //pihole-enable-piholes.json
  const enablePiholes = this.homey.flow.getActionCard('pihole-enable-piholes');
  enablePiholes.registerRunListener(async (args, state) => {
      return await this.enablePiholes(args, state);
  });

  //pihole-disable-pihole-for.json
  const disablePiholeFor = this.homey.flow.getActionCard('pihole-disable-pihole-for');
  disablePiholeFor.registerRunListener(async (args, state) => {
    return await this.disablePiholeFor(args, state);
  });
  
  //pihole-disable-piholes-for.json
  const disablePiholesFor = this.homey.flow.getActionCard('pihole-disable-piholes-for');
  disablePiholesFor.registerRunListener(async (args, state) => {
    return await this.disablePiholesFor(args, state);
  });

  //pihole-set-pihole.json
  const setPihole = this.homey.flow.getActionCard('pihole-set-pihole');
  setPihole.registerRunListener(async (args, state) => {
    return await this.setPihole(args, state);
  });


  //Bereich für Triggerkarten
  //alarm_core_update_available_true.json
  this._coreUpdateAvailable = this.homey.flow.getTriggerCard('alarm_core_update_available_true')
    this._coreUpdateAvailable.registerRunListener(async (args, state) => {
      try{

        await args.device.device(this.getName());
        await args.device.service('Core');
        return true;
      }
      catch(error){
        this.error("Error executing flowAction 'alarm_core_update_available_true': "+  error.message);
        throw new Error(error.message);
      }
    });

  //alarm_ftl_update_available_true.json
  this._FTLUpdateAvailable = this.homey.flow.getTriggerCard('alarm_ftl_update_available_true')
    this._FTLUpdateAvailable.registerRunListener(async (args, state) => {
    try{

      await args.device.device(this.getName());
      await args.device.service('FTL');
      return true;
    }
    catch(error){
      this.error("Error executing flowAction 'alarm_ftl_update_available_true': "+  error.message);
      throw new Error(error.message);
    }
  });

  // alarm_web_update_available_true.json
  this._coreUpdateAvailable = this.homey.flow.getTriggerCard('alarm_web_update_available_true')
    this._coreUpdateAvailable.registerRunListener(async (args, state) => {
      try{

      await args.device.device(this.getName());
      await args.device.service('Web');
      return true;
    }
      catch(error){
      this.error("Error executing flowAction 'alarm_web_update_available_true': "+  error.message);
      throw new Error(error.message);
    }
  });

  this.log(`${Homey.manifest.id}-${Homey.manifest.version}-Initialized`);
}
    
  //Funktionen für die Aktions-Karten
  async disablePiholes(args, state) {

    const Homey = require('homey');
    let DeviceList = this.homey.drivers.getDriver('pihole').getDevices();
    
    // Ein Array, um die konfigurierten Einstellungen aller Geräte zu speichern
    let deviceSettingsArray = [];
    
    DeviceList.forEach(device => {
        // Erhalte alle Symbole des Geräts
        const symbols = Object.getOwnPropertySymbols(device);
    
        // Finde das Symbol, das zu den 'settings' gehört
        const settingsSymbol = symbols.find(symbol => symbol.toString() === 'Symbol(settings)');
    
        // Zugriff auf die 'settings' über das gefundene Symbol, falls vorhanden
        if(settingsSymbol) {
            const settings = device[settingsSymbol];

            // Extrahiere nur die benötigten Einstellungen
            const relevantSettings = {
                url: settings.url,
                port: settings.port,
                api: settings.api
            };

            const disable_url = `${relevantSettings.url}:${relevantSettings.port}/admin/api.php?disable&auth=${relevantSettings.api}`;
            makeAPICall(disable_url);

            // Füge die relevanten Einstellungen zum Array hinzu
            deviceSettingsArray.push(relevantSettings);
        } else {
            this.log('Settings not found for device', device);
        }
    });
  }

  async enablePiholes(args, state) {

    const Homey = require('homey');
    let DeviceList = this.homey.drivers.getDriver('pihole').getDevices();
    
    // Ein Array, um die konfigurierten Einstellungen aller Geräte zu speichern
    let deviceSettingsArray = [];
    
    DeviceList.forEach(device => {
        // Erhalte alle Symbole des Geräts
        const symbols = Object.getOwnPropertySymbols(device);
    
        // Finde das Symbol, das zu den 'settings' gehört
        const settingsSymbol = symbols.find(symbol => symbol.toString() === 'Symbol(settings)');
    
        // Zugriff auf die 'settings' über das gefundene Symbol, falls vorhanden
        if(settingsSymbol) {
            const settings = device[settingsSymbol];

            // Extrahiere nur die benötigten Einstellungen
            const relevantSettings = {
                url: settings.url,
                port: settings.port,
                api: settings.api
            };

            const enable_url = `${relevantSettings.url}:${relevantSettings.port}/admin/api.php?enable&auth=${relevantSettings.api}`;
            makeAPICall(enable_url);

            // Füge die relevanten Einstellungen zum Array hinzu
            deviceSettingsArray.push(relevantSettings);
        } else {
          this.log('Settings not found for device', device);
        }
    });
    
  }

  async disablePiholeFor(args, state) {

  // Logge die Aktion für Debugging-Zwecke
  this.log('pihole-disable-pihole-for ausgeführt');

  // args.device gibt das ausgewählte Gerät an
  const device = args.device; // Stelle sicher, dass 'device' korrekt auf das Geräteargument in deiner Flow-Karte verweist

  // Annahme: Du hast eine Methode getSettings() in deiner Geräteklasse
  const settings = device.getSettings();

  try {
    const selectedTime = args.time;
    const selectedTimeSeconds = parseInt(selectedTime, 10) * 60;
    const apiUrl = `${settings.url}:${settings.port}/admin/api.php?disable=${selectedTimeSeconds}&auth=${settings.api}`;
    if (settings.api) { 
      makeAPICall(apiUrl);
    }
    
    //Loggt in die Konsole
    this.log('PiHole', settings.name, ' für ' ,selectedTime,  'deaktiviert');

    //Füllt das Token ab und gibt es zurück
    const selectedTimeMinutes = Number(selectedTime);
    return {'time': selectedTimeMinutes};

  } catch (err) {
    console.error('Error in "pihole-disable-pihole-for" actionCard:', err);
    this.log('Error in disable-pihole-for actionCard:', err);
    throw new Error("Error in API processing (pihole-disable-pihole-for)"); // oder irgendeine andere passende Meldung, die im Flow erscheinen soll.
  }
  return true; // Gibt an, dass der Listener erfolgreich ausgeführt wurde
}

async disablePiholesFor(args, state) {

  const Homey = require('homey');
  let DeviceList = this.homey.drivers.getDriver('pihole').getDevices();
  const selectedTime = args.time;
  
  // Ein Array, um die konfigurierten Einstellungen aller Geräte zu speichern
  let deviceSettingsArray = [];
  
  DeviceList.forEach(device => {
      // Erhalte alle Symbole des Geräts
      const symbols = Object.getOwnPropertySymbols(device);
  
      // Finde das Symbol, das zu den 'settings' gehört
      const settingsSymbol = symbols.find(symbol => symbol.toString() === 'Symbol(settings)');
  
      // Zugriff auf die 'settings' über das gefundene Symbol, falls vorhanden
      if(settingsSymbol) {
          const settings = device[settingsSymbol];

          // Extrahiere nur die benötigten Einstellungen
          const relevantSettings = {
              url: settings.url,
              port: settings.port,
              api: settings.api
          };

          // Füge die relevanten Einstellungen zum Array hinzu
          deviceSettingsArray.push(relevantSettings);

          try {
            const selectedTime = args.time;
            const selectedTimeSeconds = parseInt(selectedTime, 10) * 60;
            const apiUrl = `${settings.url}:${settings.port}/admin/api.php?disable=${selectedTimeSeconds}&auth=${settings.api}`;
            if (settings.api) { 
              makeAPICall(apiUrl);
            }
          } catch (err) {
            console.error('Error in "pihole-disable-piholes-for" actionCard:', err);
            this.log('Error in disable-piholes-for actionCard:', err);
            throw new Error("Error in API processing (pihole-disable-piholes-for)"); // oder irgendeine andere passende Meldung, die im Flow erscheinen soll.
          }
           return true; // Gibt an, dass der Listener erfolgreich ausgeführt wurde
        }
  });
            //Loggt in die Konsole
            this.log('Alle PiHoles', 'für ' ,selectedTime,  'deaktiviert');
}

async setPihole(args, state) {
  
  // Logge die Aktion für Debugging-Zwecke
  this.log('pihole-set-pihole-for ausgeführt');

  // make sure args.state and args.instance are not undefined
  let selectedState = args.state || '5';
  let ActionState = "";

  // Handling different states
  switch (selectedState) {
    case '5':
      console.log('Activate selected');
      ActionState = "enable";
      // ..
      break;
    case '10':
      console.log('Deactivate selected');
      ActionState = "disable";
      // ..
      break;
    default:
      console.error('Unknown state selected.');
  }

  // args.device gibt das ausgewählte Gerät an
  const device = args.device; // Stelle sicher, dass 'device' korrekt auf das Geräteargument in deiner Flow-Karte verweist

  // Annahme: Du hast eine Methode getSettings() in deiner Geräteklasse
  const settings = device.getSettings();

  try {
        const apiUrl = `${settings.url}:${settings.port}/admin/api.php?${ActionState}&auth=${settings.api}`;
    
    if (settings.api) { 
      makeAPICall(apiUrl);
    }
    
    //Loggt in die Konsole
    this.log('Set-PiHole:', ActionState);
  } catch (err) {
    console.error('Error in "pihole-set-pihole" actionCard:', err);
    this.log('Error in pihole-set-pihole actionCard:', err);
    throw new Error("Error in API processing (pihole-set-pihole)"); // oder irgendeine andere passende Meldung, die im Flow erscheinen soll.
  }
  return true; // Gibt an, dass der Listener erfolgreich ausgeführt wurde
}
}

module.exports = PiHoleControl;

//Hilfs-Funktion für API Aufruf
async function makeAPICall(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    console.log('API-Aufruf erfolgreich');
    return { success: true }; // Erfolgsstatus zurückgeben

  } catch (error) {
    console.error('Fehler beim API-Aufruf:', error);
    return { success: false, errorMessage: error.message }; // Fehlerstatus und Fehlermeldung zurückgeben
  }
}