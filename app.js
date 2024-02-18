'use strict';

const Homey = require('homey');
////////////////////////////////////////////////////////////////////////////////////////
// Definieren Sie die Variable alarmFilterState
let alarmFilterState = true; // Beispiel: Filter ist aktiviert
////////////////////////////////////////////////////////////////////////////////////////

class PiHoleControl extends Homey.App {
  async onInit() {

    if (process.env.DEBUG === '1'){
      try{ 
        require('inspector').waitForDebugger();
      }
      catch(error){
        require('inspector').open(9225, '0.0.0.0', true);
      }
  }

  //Schreibe ins Log
  this.log(`${Homey.manifest.id}-${Homey.manifest.version}-Initialization ....`);

  await super.onInit();

  //Schreibe eine Meldung in die Time-Line wegen altem Treiber-Modell
  this.homey.notifications.createNotification({excerpt: this.homey.__('warnings.deprecated1')}).catch(error => {this.error('Error sending notification: '+error.message)});
  this.homey.notifications.createNotification({excerpt: this.homey.__('warnings.deprecated2')}).catch(error => {this.error('Error sending notification: '+error.message)});

  // *****************************************************************************************************************
  // NEUER TREIBER: PIHOLE
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

  ///////////////////////////////////////////////////////////////////////////////////////

  // IN PROGRESS
  
   //TODO ALLE TRIGGER KARTEN
    async function updateFilterStateAndTrigger() {
    // Annahme: Der Filterstatus wird aktualisiert und alarmFilterState wird entsprechend gesetzt
    let alarmFilterState = true; // Beispiel: Der Filter ist aktiviert

    // Auslösen des Flow-Kartenereignisses "alarm_filter_state_changed"
    const connectionStateTrigger = this.homey.flow.getTriggerCard('alarm_filter_state_changed');
    await connectionStateTrigger.trigger({
        alarm_filter_state: alarmFilterState
    });
}



// IN PROGRESS
///////////////////////////////////////////////////////////////////////////////////////


//TODO ALLE TRIGGER KARTEN

  // *****************************************************************************************************************
  //ALTER TREIBER PI-HOLE //
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

   //Erstellen Sie die URL(s) für den API-Aufruf
  const disable_url1 = `${instance1_url}:${instance1_port}/admin/api.php?disable&auth=${instance1_api}`;
  const disable_url2 = `${instance2_url}:${instance2_port}/admin/api.php?disable&auth=${instance2_api}`;
  const disable_url3 = `${instance3_url}:${instance3_port}/admin/api.php?disable&auth=${instance3_api}`;
  const disable_url4 = `${instance4_url}:${instance4_port}/admin/api.php?disable&auth=${instance4_api}`;
  
  const enable_url1 = `${instance1_url}:${instance1_port}/admin/api.php?enable&auth=${instance1_api}`;
  const enable_url2 = `${instance2_url}:${instance2_port}/admin/api.php?enable&auth=${instance2_api}`;
  const enable_url3 = `${instance3_url}:${instance3_port}/admin/api.php?enable&auth=${instance3_api}`;
  const enable_url4 = `${instance4_url}:${instance4_port}/admin/api.php?enable&auth=${instance4_api}`;

  //Aktions-Karten
  //disable-piholes.json
  this.homey.flow.getActionCard('disable-piholes').registerRunListener(async (args, state) => {
    try {

      if (instance1_api) { 
        await makeAPICall(disable_url1);
      }

      if (instance2_api) { 
        await makeAPICall(disable_url2);
      }

      if (instance3_api) { 
        await makeAPICall(disable_url3);
      }

      if (instance3_api) { 
        await makeAPICall(disable_url4);
      }
  
  } catch (err) {
    this.log("Error in 'disable-piholes' actionCard:", err); // fürs Log
    throw new Error("Error in API (disable-piholes) processing"); // oder irgendeine andere passende Meldung, die im Flow erscheinen soll.
  }
  });

  //enable-piholes.json
  this.homey.flow.getActionCard('enable-piholes').registerRunListener(async (args, state) => {
    try {
      if (instance1_api) { 
        await makeAPICall(enable_url1);
      }

      if (instance2_api) { 
        await makeAPICall(enable_url2);
      }

      if (instance3_api) { 
        await makeAPICall(enable_url3);
      }

      if (instance3_api) { 
        await makeAPICall(enable_url4);
      }
    
    } catch (err) {
      console.error('Error "enable-piholes" actionCard:', err);
      this.log("Error in 'enable-piholes' actionCard:", err); // fürs Log
      throw new Error("Error in API (enable-piholes) processing"); // oder irgendeine andere passende Meldung, die im Flow erscheinen soll.
    }
  });

  //set-piholes.json
  this.homey.flow.getActionCard('set-piholes').registerRunListener(async (args, state) => {

    try {
   
      // make sure args.state and args.instance are not undefined
      let selectedState = args.state || '5';
      let selectedInstance = args.instance || '10';
  
      let ActionState = "";
      let url = ""

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
  
      // Handling different instances
      switch (selectedInstance) {
        case '5':
          console.log('Instance 1 selected');
          url = `${instance1_url}:${instance1_port}/admin/api.php?${ActionState}&auth=${instance1_api}`;
          if (instance1_api) { 
            makeAPICall(url)
          }
          break;
        case '10':
          console.log('Instance 2 selected');
          url = `${instance2_url}:${instance2_port}/admin/api.php?${ActionState}&auth=${instance2_api}`;
          if (instance2_api) { 
            makeAPICall(url)
          }
          break;
        case '15':
          console.log('Instance 3 selected');
          url = `${instance3_url}:${instance3_port}/admin/api.php?${ActionState}&auth=${instance3_api}`;
          if (instance3_api) { 
            makeAPICall(url)
          }
          break;
        case '20':
          console.log('Instance 4 selected');
          url = `${instance4_url}:${instance4_port}/admin/api.php?${ActionState}&auth=${instance4_api}`;
          if (instance4_api) { 
            makeAPICall(url)
          }
          break;
        default:
          console.error('Unknown instance selected');
       }

      } catch (err) {
      this.log("Error in 'set-piholes' actionCard:", err); // fürs Log
      throw new Error("Error in API (set-piholes) processing"); // oder irgendeine andere passende Meldung, die im Flow erscheinen soll.
    }
  });

  //disable-pihole-for.json
this.homey.flow.getActionCard('disable-pihole-for').registerRunListener(async(args, state) => {
  try {
    const instances = {
      "5": {
        text: "Instance 1",
        url: this.homey.settings.get('Instance1_URL'),
        port: this.homey.settings.get('Instance1_PORT'),
        api: this.homey.settings.get('Instance1_API'),
      },
      "10": {
        text: "Instance 2",
        url: this.homey.settings.get('Instance2_URL'),
        port: this.homey.settings.get('Instance2_PORT'),
        api: this.homey.settings.get('Instance2_API')
      },
      "15": {
        text: "Instance 3",
        url: this.homey.settings.get('Instance3_URL'),
        port: this.homey.settings.get('Instance3_PORT'),
        api: this.homey.settings.get('Instance3_API')
      },
      "20": {
        text: "Instance 4",
        url: this.homey.settings.get('Instance4_URL'),
        port: this.homey.settings.get('Instance4_PORT'),
        api: this.homey.settings.get('Instance4_API')
      }
    };
    
    const selectedInstance = args.pihole;
    const selectedTime = args.time;
    
    const instance = instances[selectedInstance];
    if (!instance) {
      console.error('Unknown instance selected');
    }
    
    const { url, port, api } = instance;
    const selectedTimeSeconds = parseInt(selectedTime, 10) * 60;
    
    const apiUrl = `${url}:${port}/admin/api.php?disable=${selectedTimeSeconds}&auth=${api}`;
   
    // Hier musst du die makeAPICall-Funktion entsprechend implementieren, um den API-Aufruf durchzuführen
    if (api) { 
      makeAPICall(apiUrl);
    }
    
    //Loggt in die Konsole
    this.log(`Disabled PiHole ${instance.text} for ${selectedTime} minutes`);

    //Füllt das Token ab und gibt es zurück
    const selectedTimeMinutes = Number(selectedTime);
    return {'instance': instance.text, 'time': selectedTimeMinutes};


  } catch (err) {
    console.error('Error in "disable-pihole-for" actionCard:', err);
    this.log("Error in 'disable-pihole-for actionCard':", err); // fürs Log
    throw new Error("Error in API processing (disable-pihole-for)"); // oder irgendeine andere passende Meldung, die im Flow erscheinen soll.
  }
});

//disable-piholes-for.json
  this.homey.flow.getActionCard('disable-piholes-for').registerRunListener(async (args, state) => {
    try {
      const selectedTime = args.time;
      const selectedTimeSeconds = parseInt(selectedTime, 10) * 60;
      
      const instance1 = `${instance1_url}:${instance1_port}/admin/api.php?disable=${selectedTimeSeconds}&auth=${instance1_api}`;
      const instance2 = `${instance2_url}:${instance2_port}/admin/api.php?disable=${selectedTimeSeconds}&auth=${instance2_api}`;
      const instance3 = `${instance3_url}:${instance3_port}/admin/api.php?disable=${selectedTimeSeconds}&auth=${instance3_api}`;
      const instance4 = `${instance4_url}:${instance4_port}/admin/api.php?disable=${selectedTimeSeconds}&auth=${instance4_api}`;

      // Hier musst du die makeAPICall-Funktion entsprechend implementieren, um den API-Aufruf durchzuführen
      
      if (instance1_api) {
        makeAPICall(instance1);
      }
      
      if (instance2_api) {
        makeAPICall(instance2);
      }

      if (instance3_api) {
        makeAPICall(instance3);
      }

      if (instance4_api) {
        makeAPICall(instance4);
      }
      
      this.log(`Disabled all PiHoles for ${selectedTime} minutes`);
      
      //Füllt das Token ab und gibt es zurück
      const selectedTimeMinutes = Number(selectedTime);
      return {'time': selectedTimeMinutes};

  
    } catch (err) {
      console.error('Error in "disable-piholes-for actionCard":', err);
      this.log("Error in 'disable-piholes-for actionCard':", err); // fürs Log
      throw new Error("Error in API processing (disable-piholes-for)"); // oder irgendeine andere passende Meldung, die im Flow erscheinen soll.
    }
    });
}
  //ALTER TREIBER PI-HOLE //
  // *****************************************************************************************************************
  
  
  
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
            this.log('PiHole Control: Settings not found for device', device);
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
          this.log('PiHole Control: Settings not found for device', device);
        }
    });
    
  }

  async disablePiholeFor(args, state) {

  // Logge die Aktion für Debugging-Zwecke
  this.log('PiHole Control: pihole-disable-pihole-for ausgeführt');

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
    this.log('PiHole Control: PiHole', settings.name, ' für ' ,selectedTime,  'deaktiviert');

    //Füllt das Token ab und gibt es zurück
    const selectedTimeMinutes = Number(selectedTime);
    return {'time': selectedTimeMinutes};

  } catch (err) {
    console.error('Error in "pihole-disable-pihole-for" actionCard:', err);
    this.log('PiHole Control: Error in disable-pihole-for actionCard:', err);
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
            this.log('PiHole Control: Error in disable-piholes-for actionCard:', err);
            throw new Error("Error in API processing (pihole-disable-piholes-for)"); // oder irgendeine andere passende Meldung, die im Flow erscheinen soll.
          }
           return true; // Gibt an, dass der Listener erfolgreich ausgeführt wurde
        }
  });
            //Loggt in die Konsole
            this.log('PiHole Control: Alle PiHoles', 'für ' ,selectedTime,  'deaktiviert');
}

async setPihole(args, state) {
  
  // Logge die Aktion für Debugging-Zwecke
  this.log('PiHole Control: pihole-set-pihole-for ausgeführt');

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
    this.log('PiHole Control: Set-PiHole:', ActionState);
  } catch (err) {
    console.error('Error in "pihole-set-pihole" actionCard:', err);
    this.log('PiHole Control: Error in pihole-set-pihole actionCard:', err);
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

    console.log('PiHole Control: API-Aufruf erfolgreich');
    return { success: true }; // Erfolgsstatus zurückgeben

  } catch (error) {
    console.error('Fehler beim API-Aufruf:', error);
    return { success: false, errorMessage: error.message }; // Fehlerstatus und Fehlermeldung zurückgeben
  }
}