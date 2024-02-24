const Homey = require('homey');
const PiholeDevice = require('./device'); // Stellen Sie sicher, dass der Pfad korrekt ist.
const CAPABILITY_DEBOUNCE = 500;

//Festlegen einer Map für die Task-Verwaltung
let intervalIds = new Map();

class PiHoleDevice extends Homey.Device {

    async onInit() {

      this.log('Gerät wurde initialisiert');
      
      //Ansprechen der Einstellungen, damit Zugriff darauf gewähleistet ist
      const deviceSettings = this.getSettings();
             
   // Prüfen, ob Geräteeinstellungen vorhanden sind
   if (deviceSettings) {

      //Die nötigen Einstellungen holen und bereitstellen
      const device_url = deviceSettings.url
      const device_port = deviceSettings.port
      const device_api = deviceSettings.api
      const device_interval = deviceSettings.interval
      
      //Schreiben ins Log File
      this.log('*******************************************************')
      this.log('URL   ->', device_url);
      this.log('Port  ->', device_port);
      this.log('Key   ->', device_api);
      this.log('Akt.  ->', device_interval, 'Minute(n)');
      this.log('*******************************************************')

      //Herausfinden welches Gerät das ist
      this.log('Identifiziert und initialisiert ..')
     
      //Bereitstellen der nötigen URLs für Aktionen / Abfragen
      const disable_url = `${device_url}:${device_port}/admin/api.php?disable&auth=${device_api}`;
      const enable_url = `${device_url}:${device_port}/admin/api.php?enable&auth=${device_api}`;
      const status_url = `${device_url}:${device_port}/admin/api.php?summaryRaw&auth=${device_api}`;
  
      //Schreiben ins Log File
      this.log('URL Disable ->', disable_url);
      this.log('URL Enable  ->', enable_url);
      this.log('URL Status  ->', status_url);

      //Capabilities Updaten (Danke Ronny Winkler)
      await this._updateCapabilities();

      //Capabilities Listener
       this.registerMultipleCapabilityListener(this.getCapabilities(), async (capabilityValues, capabilityOptions) => {
        // try{
            await this._onCapability( capabilityValues, capabilityOptions);
        // }
        // catch(error){
        //     this.log("_onCapability() Error: ",error);
        // }
      },CAPABILITY_DEBOUNCE);

      let deviceSettingsArray = [
        {
          url: device_url,
          port: device_port,
          api: device_api,
          interval: device_interval
        },
      ]; 

      deviceSettingsArray.forEach(deviceSettings => {
        const status_url = `${device_url}:${device_port}/admin/api.php?summaryRaw&auth=${device_api}`;
      
        // Erstellen des wiederkehrenden Tasks
        const deviceId = this.getId();
        
        //Task neu erstellen
        this.createTask(deviceId)
      });


      //Schreibt den Status, bei Veränderung, ins Log File
      this.registerCapabilityListener('onoff', async (value) => {
      this.log('Eingeschaltet:' ,value);
      const deviceId = this.getData().id;

      //Reagiert darauf, wenn das Gerät nicht erreichbar ist
      this.setUnavailable(this.homey.__('device.unavailable')).catch(this.error);

      if (value) {
        this.log('Eingeschaltet:' ,value);
        this._makeAPICall(enable_url)
      } else {
        this.log('Ausgeschaltet:' ,value);
        this._makeAPICall(disable_url)
      }
      }
    )
      } else {
        this.log('Keine Geräteeinstellungen gefunden. Aktionen werden nicht ausgeführt.');
    }
  
  }

 /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
 async onAdded() {
  this.log('Gerät wurde hinzugefügt' ,value);
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
  this.log(`[Device] ${this.getName()}: Einstellung geändert: ${changedKeys}`);
  this._settings = newSettings;

  if (changedKeys.includes('interval')) {
    // 'interval' wurde geändert
    this.log(`[Device] ${this.getName()}: Intervall-Einstellung geändert: ${newSettings.interval} Minute(n)`);

    const deviceId = this.getId();

    //Task löschen
    setTimeout(() => {
      this.deleteTask(deviceId)
    }, 1000); // Verzögerung von einer Sekunde (1000 Millisekunden)


    //Task löschen
    setTimeout(() => {
      this.createTask(deviceId)
    }, 1000); // Verzögerung von einer Sekunde (1000 Millisekunden)

   }
}

/**
 * onRenamed is called when the user updates the device's name.
 * This method can be used this to synchronise the name to the device.
 * @param {string} name The new name
 */
async onRenamed(name) {
  this.log('Gerät wurde umbenannt' ,value);
}

/**
 * onDeleted is called when the user deleted the device.
 */
async onDeleted() {
  const deviceId = this.getId();

  //Task löschen
  this.deleteTask(deviceId)
}

async _updateCapabilities(){
  let capabilities = [];
  try{
    capabilities = this.homey.app.manifest.drivers.filter((e) => {return (e.id == this.driver.id);})[0].capabilities;
    // remove capabilities
    let deviceCapabilities = this.getCapabilities();
    for (let i=0; i<deviceCapabilities.length; i++){
      let filter = capabilities.filter((e) => {return (e == deviceCapabilities[i]);});
      if (filter.length == 0 ){
        try{
          await this.removeCapability(deviceCapabilities[i]);
        }
        catch(error){}
      }
    }
    // add missing capabilities
    for (let i=0; i<capabilities.length; i++){
      if (!this.hasCapability(capabilities[i])){
        try{
          await this.addCapability(capabilities[i]);
        }
        catch(error){}
      }
    }
  }
  catch (error){
    this.error(error.message);
  }
}

// CAPABILITIES =======================================================================================

async _onCapability( capabilityValues, capabilityOptions){

  //Ansprechen der Einstellungen, damit Zugriff darauf gewähleistet ist
  const deviceSettings = this.getSettings();
             
  //Die nötigen Einstellungen holen und bereitstellen
  const device_url = deviceSettings.url
  const device_port = deviceSettings.port
  const device_api = deviceSettings.api
  const device_Name = this.getName()


  //Schreiben ins Log File
  this.log('*******************************************************')
  this.log('ID   ->', device_Name);
  this.log('URL  ->', device_url);
  this.log('Port ->', device_port);
  this.log('Key  ->', device_api);
  this.log('*******************************************************')

  //Bereitstellen der nötigen URLs für Aktionen / Abfragen
  const status_url = `${device_url}:${device_port}/admin/api.php?summaryRaw&auth=${device_api}`;

  if( capabilityValues["data_refresh"] != undefined){
    this._updateDeviceData(status_url);
  }
}

// Helpers =======================================================================================
async _makeAPICall(url) {

    try {
      const response = await fetch(url);
  
      if (!response.ok) {
        throw new Error(response.statusText);
      }
      this.log('API Aufruf erfolgreich');
      return { success: true }; // Erfolgsstatus zurückgeben
  
    } catch (error) {
      this.log('API Aufruf fehlgeschlagen:');
      this.log(errorMessage);
      return { success: false, errorMessage: error.message }; // Fehlerstatus und Fehlermeldung zurückgeben
    }
}


async _updateDeviceData(url) {

  try {
    const response = await fetch(url);
    // Überprüft, ob der Statuscode im Erfolgsbereich liegt (200-299) oder 403 ist
    if (!response.ok && response.status !== 403) { 
        throw new Error(`Status Filter: ${response.status}`);
    } else {
    }

    const data = await response.json();
  
  fetch(url).then(response => response.json())
  .then(data => {
      
      //Fülle Variable mit Gerätename ab
      const deviceName = this.getName()

      //Saubere Formatierung des Status   
      let PiHoleState = false

      if(data.status === 'enabled') {
        PiHoleState = false
      } else {
        PiHoleState = true
      }
       //Datum sauber formatieren
      let syncDate = new Date();
      let day = syncDate.toLocaleDateString('de-DE', { 
        day: '2-digit', 
        month: '2-digit', 
        year: '2-digit', 
        timeZone: this.homey.clock.getTimezone() 
      });
      let time = syncDate.toLocaleTimeString('de-DE', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: this.homey.clock.getTimezone()
      });

      // Datum und Uhrzeit zusammenführen
      let formattedSyncDate = `${time} | ${day}`;

      // DNS Anfragen pro Tag
      let dns_queries_today = data.dns_queries_today;
      let formatted_dns_queries_today;

      if (dns_queries_today !== undefined && dns_queries_today !== null) {
        formatted_dns_queries_today = dns_queries_today.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1'");
      } else {
        formatted_dns_queries_today = "N/A";
      }


      // Geblockte ADDs pro Tag
      let blocked_adds_today = data.ads_blocked_today;
      let formatted_blocked_adds_today = blocked_adds_today ? blocked_adds_today.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1'") : "N/A";

      //Geblockte ADD pro Tag in %
      let blocked_adds_today_percent = data.ads_percentage_today;
      let formated_blocked_adds_today_percent = blocked_adds_today_percent.toFixed(1) + " %"
      
      //Letztes Update der Gravity Datenbank
      let absoluteTimestamp = data.gravity_last_updated.absolute;

      //Aktueller Zeitstempel
      const currentTimestamp = Math.floor(Date.now() / 1000); // in Sekunden

      //Zeitdifferenz berechnen
      const timeDifference = currentTimestamp - absoluteTimestamp;

      //In Tage, Stunden und Minuten umrechnen
      const gravity_update_days = Math.floor(timeDifference / (24 * 3600));
      const gravity_update_hours = Math.floor((timeDifference % (24 * 3600)) / 3600);
      const gravity_update_minutes = Math.floor((timeDifference % 3600) / 60);

      let gravity_update_string = gravity_update_days + ' Tg. ' + gravity_update_hours +' Std. ' + gravity_update_minutes + ' Min.';        

      // Loggen der Werte zwecks Diagnose
      this.log('');
      this.log('*******************************************************');
      this.log('Task Geräte Abgleich: GESTARTET');
      this.log('Aktuelles Gerät:', deviceName);
      this.log('Status Filter:' , data.status);
      this.log('DNS Querys pro Tag:' , formatted_dns_queries_today);
      this.log('Werbeanzeigen geblockt:' , formatted_blocked_adds_today);
      this.log('Werbeanzeigen geblockt in Prozent:' , formated_blocked_adds_today_percent);
      this.log('Letztes Gravity Update:' ,gravity_update_string);
      this.log('Letzter Sync' , formattedSyncDate);
      this.log('Task Geräte Abgleich: BEENDET');
      this.log('*******************************************************');
      this.log('');

      //Fehlerüberprüfung, sollte UNDEFINED zurückkommen
      if (typeof data.dns_queries_today !== 'undefined') {
        let dns_queries_today = data.dns_queries_today;
        let formatted_dns_queries_today = dns_queries_today.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1'");
        this.setCapabilityValue('measure_dns_queries_today', dns_queries_today);
      } else {
        this.log('Fehler --> dns_queries_today ist nicht definiert');
      }

    if (typeof data.ads_blocked_today !== 'undefined') {
        let blocked_adds_today = data.ads_blocked_today;
        let formatted_blocked_adds_today = blocked_adds_today.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1'");
        this.setCapabilityValue('measure_ads_blocked_today', blocked_adds_today);
    } else {
        this.log('Fehler --> blocked_adds_today ist nicht definiert');
      }

    if (typeof formattedSyncDate !== 'undefined') {
        this.setCapabilityValue('last_sync', formattedSyncDate);
    } else {
        this.log('Fehler --> last_sync ist nicht definiert');
    }

    if (typeof blocked_adds_today_percent !== 'undefined') {
        this.setCapabilityValue('measure_ads_blocked_today_percent', blocked_adds_today_percent);
    } else {
        this.log('Fehler --> measure_ads_blocked_today_percent ist nicht definiert');
    }

    if (typeof gravity_update_string !== 'undefined') {
        this.setCapabilityValue('gravity_last_update', gravity_update_string);
    } else {
        this.log('Fehler --> gravity_last_update ist nicht definiert');
    }

    // Capabilities für den Rest setzen
    this.setCapabilityValue('alarm_communication_error', false);
    this.setCapabilityValue('alarm_filter_state', PiHoleState);

});
} catch (error) {
  this.log('Ein Fehler ist aufgetreten ->', error.message);
  
  // Jetzt können Sie Capabilities für dieses Gerät setzen
  this.setCapabilityValue('alarm_communication_error', true); 
}
} 


//TASK Verwaltung
async deleteTask(deviceId) {
  // Überprüfen, ob für die deviceId ein Task existiert
  if (intervalIds.has(deviceId)) {
    // Hole die intervalId und stoppe das Intervall
    clearInterval(intervalIds.get(deviceId));
    this.log('Task für Gerät' ,deviceId, 'gestoppt.');

    // Entferne die intervalId aus der Map
    intervalIds.delete(deviceId);
    this.log('Task für Gerät' ,deviceId, 'gelöscht.');

  } else {
    this.log('Kein Task gefunden für Gerät' ,deviceId,);
  }
}

async createTask(deviceId) {
  
    // Vorhandenes Intervall beenden, falls es bereits existiert
    const existingIntervalId = intervalIds.get(deviceId);
    if (existingIntervalId) {
      clearInterval(existingIntervalId);
      intervalIds.delete(deviceId); // Entferne das Intervall aus der Map
    }
  
    // Ansprechen der Einstellungen, um darauf zugreifen zu können
    const deviceSettings = this.getSettings();
  
    // Die nötigen Einstellungen holen und bereitstellen
    const device_url = deviceSettings.url;
    const device_port = deviceSettings.port;
    const device_api = deviceSettings.api;
  
    // Bereitstellen der nötigen URLs für Aktionen / Abfragen
    const status_url = `${device_url}:${device_port}/admin/api.php?summaryRaw&auth=${device_api}`;
  
    // Die nötigen Einstellungen holen und bereitstellen
    const device_interval = deviceSettings.interval;
  
    // Umrechnen der Interval ID in Millisekunden
    const device_interval_minutes = device_interval; // Der Wert von device_interval in Minuten
    const device_interval_milliseconds = device_interval_minutes * 60000;
  
    // Erstelle einen neuen Task (z.B. eine Funktion, die regelmäßig ausgeführt wird)
    const intervalId = setInterval(() => {
      this._updateDeviceData(status_url);
    }, device_interval_milliseconds); // gem. eingestelltem Intervall
  
    // Speichere die neue intervalId in der Map
    intervalIds.set(deviceId, intervalId);
    this.log('Neuer Task erstellt für Gerät:', deviceId);
}
}
module.exports = PiHoleDevice;