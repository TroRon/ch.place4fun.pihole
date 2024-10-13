const Homey = require('homey');

//Allgemeine Parameter
let absoluteTimestamp;
let blocked_adds_today_percent;
let formated_blocked_adds_today_percent;



class PiHoleDevice extends Homey.Device {

    intervalId = undefined

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
     //Task neu erstellen
     this.createTask()


     //Schreibt den Status, bei Veränderung, ins Log File
     this.registerCapabilityListener('onoff', async (value) => {
         this.log('Eingeschaltet:', value);

         if (value) {
           this.log('Eingeschaltet:', value);
           this._makeAPICall(enable_url)
         } else {
           this.log('Ausgeschaltet:', value);
           this._makeAPICall(disable_url)
         }
       }
     )

       this.registerCapabilityListener('data_refresh', async (value) => {
           const api_key = deviceSettings.api
           const status_url = `${this.getHost()}/admin/api.php?summaryRaw&auth=${api_key}`;
           this._updateDeviceData(status_url);
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

  if (changedKeys.includes('url')) {
    // 'url' wurde geändert
    this.log(`[Device] ${this.getName()}: URL-Einstellung geändert: ${newSettings.url}`);
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

   if (changedKeys.includes('port')) {
    // 'port' wurde geändert
    this.log(`[Device] ${this.getName()}: Port-Einstellung geändert: ${newSettings.interval}`);
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

   if (changedKeys.includes('api')) {
    // 'api' wurde geändert
    this.log(`[Device] ${this.getName()}: API-Einstellung geändert: ${newSettings.interval}`);
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
    this.deleteTask()
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

async _updateDeviceData() {
  const deviceSettings = this.getSettings();
  // Die nötigen Einstellungen holen und bereitstellen
  const api_key = deviceSettings.api;
  const url = `${this.getHost()}/admin/api.php?summaryRaw&auth=${api_key}`;

  try {
  fetch(url).then(response => {
    if (!response.ok && response.status !== 403) {
      throw new Error(`Status Filter: ${response.status}`);
    }
    response.json().then(data => {

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

      // Update Prüfung
      const update_url = `${this.getHost()}/admin/api.php?versions`;
      this.checkUpdateAvailable(deviceName, update_url)

      // Geblockte ADDs pro Tag
      let blocked_adds_today = data.ads_blocked_today;
      let formatted_blocked_adds_today = blocked_adds_today ? blocked_adds_today.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1'") : "N/A";

      //Geblockte ADD pro Tag in %
      if (data.ads_percentage_today !== undefined) {
        blocked_adds_today_percent = parseFloat(data.ads_percentage_today.toFixed(1));
        formated_blocked_adds_today_percent = blocked_adds_today_percent.toFixed(1) + " %";
    } else {
        // Handle den Fall, wenn data.ads_percentage_today undefined ist
        blocked_adds_today_percent = 0; // Setze einen Standardwert
        formated_blocked_adds_today_percent = "n/a";
    }

      //Letztes Update der Gravity Datenbank
      if (data.gravity_last_updated && data.gravity_last_updated.absolute !== undefined) {
        absoluteTimestamp = data.gravity_last_updated.absolute;
      } else {
        // Handle den Fall, wenn data.gravity_last_updated.absolute undefined ist
        absoluteTimestamp = "n/a"; // Setze einen Standardwert
      }
      //Aktueller Zeitstempel
      const currentTimestamp = Math.floor(Date.now() / 1000); // in Sekunden

      //Zeitdifferenz berechnen
      const timeDifference = currentTimestamp - absoluteTimestamp;

      //In Tage, Stunden und Minuten umrechnen
      const gravity_update_days = Math.floor(timeDifference / (24 * 3600));
      const gravity_update_hours = Math.floor((timeDifference % (24 * 3600)) / 3600);
      const gravity_update_minutes = Math.floor((timeDifference % 3600) / 60);

      let gravity_update_string = gravity_update_days + ' ' + this.homey.__('capabilities.gravity_days') + ' ' +  gravity_update_hours + ' ' +  this.homey.__('capabilities.gravity_hours') + ' ' +  gravity_update_minutes + ' ' + this.homey.__('capabilities.gravity_minutes');

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
      if (typeof formattedSyncDate !== 'undefined') {
        this.setCapabilityValue('last_sync', formattedSyncDate);
      } else {
        this.log('Fehler --> last_sync ist nicht definiert');
      }

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
    })
  });
} catch (error) {
  this.log('Ein Fehler ist aufgetreten ->', error.message);

  // Jetzt können Sie Capabilities für dieses Gerät setzen
  this.setCapabilityValue('alarm_communication_error', true);
}
}


//TASK Verwaltung
  async deleteTask() {
    // Überprüfen, ob für die deviceId ein Task existiert
    if (this.intervalId) {
      // Hole die intervalId und stoppe das Intervall
      clearInterval(this.intervalId);
      this.log('Task für Gerät', this.getId(), 'gestoppt.');
      this.intervalId = undefined
      this.log('Task für Gerät', this.getId(), 'gelöscht.');
    } else {
      this.log('Kein Task gefunden für Gerät', this.getId(),);
    }
  }

async createTask() {

    // Vorhandenes Intervall beenden, falls es bereits existiert
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Ansprechen der Einstellungen, um darauf zugreifen zu können
    const deviceSettings = this.getSettings();

    // Bereitstellen der nötigen URLs für Aktionen / Abfragen
    const device_interval_milliseconds = deviceSettings.interval * 60_000;

    // Erstelle einen neuen Task (z.B. eine Funktion, die regelmäßig ausgeführt wird)
    this.intervalId = setInterval(() => {
      this._updateDeviceData();
    }, device_interval_milliseconds); // gem. eingestelltem Intervall

    this.log('Neuer Task erstellt für Gerät:', this.getId());
}

async checkUpdateAvailable(device, url) {
  try {

    const response = await fetch(url);
    const data = await response.json();

    this.log('Update Prüfung beginnt');

    // Überprüfe ob ein Core Update vorhanden ist
    if (data.core_update == true) {
      this.log(device,': Core Update von', data.core_current, 'zu',  data.core_latest, 'verfügbar');
      this.setCapabilityValue('core_update_available', true);
    } else {
      this.log(device,': Kein Core Update verfügbar.');
      this.setCapabilityValue('core_update_available', false);
    }

    // Überprüfe ob ein Core Update vorhanden ist
    if (data.web_update == true) {
      this.log(device,': Web Update von', data.web_update, 'zu',  data.web_latest, 'verfügbar');
      this.setCapabilityValue('web_update_available', true);

    } else {
      this.log(device,': Kein Web Update verfügbar.');
      this.setCapabilityValue('web_update_available', false);
    }

    // Überprüfe ob ein Core Update vorhanden ist
    if (data.FTL_update == true) {
       this.log(device,': FTL Update von', data.FTL_current, 'zu',  data.FTL_latest, 'verfügbar');
       this.setCapabilityValue('ftl_update_available', true);
    } else {
       this.log(device,': Kein FTL Update verfügbar.');
       this.setCapabilityValue('ftl_update_available', false);
    }

  } catch (error) {
    this.error('Fehler beim Abrufen der Pi-hole-Daten:', error);
  }

  this.log('Update Prüfung beendet');
}

    getHost() {
        const deviceSettings = this.getSettings();
        const device_url = deviceSettings.url
        const device_port = deviceSettings.port || 80
        return `${device_url}:${device_port}`
    }

}
module.exports = PiHoleDevice;