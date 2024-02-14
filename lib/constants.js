const Homey = require('homey');

module.exports = Object.freeze({
  getInstanceSettings: function () {
    
    //Bereitstellen der nötigen Informationen
    const instance1_url = Homey.ManagerSettings.get('Instance1_URL');
    const instance1_port = Homey.ManagerSettings.get('Instance1_PORT');
    const instance1_api = Homey.ManagerSettings.get('Instance1_API');

    const instance2_url = Homey.ManagerSettings.get('Instance2_URL');
    const instance2_port = Homey.ManagerSettings.get('Instance2_PORT');
    const instance2_api = Homey.ManagerSettings.get('Instance2_API');

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
    const enable_url4 = `${instance4_url}:${instance4_port}/admin/api.php?enable&auth=${instance4_api}`

    const instance1_status = `${instance1_url}:${instance1_port}/admin/api.php?summaryRaw&auth=${instance1_api}`;
    const instance2_status = `${instance2_url}:${instance2_port}/admin/api.php?summaryRaw&auth=${instance2_api}`;
    const instance3_status = `${instance3_url}:${instance3_port}/admin/api.php?summaryRaw&auth=${instance3_api}`;
    const instance4_status = `${instance4_url}:${instance4_port}/admin/api.php?summaryRaw&auth=${instance4_api}`;

    let instance1_id = 'pihole-instance1';
    let instance2_id = 'pihole-instance2';
    let instance3_id = 'pihole-instance3';
    let instance4_id = 'pihole-instance4';

    return {
      instance1_id,
      instance1_status,
      instance1_url,
      enable_url1,
      disable_url1,
      instance1_port,
      instance1_api,
      
      instance2_id,
      instance2_status,
      instance2_url,
      enable_url2,
      disable_url2,
      instance2_port,
      instance2_api,
      
      instance3_id,
      instance3_status,
      instance3_url,
      enable_url3,
      disable_url3,
      instance3_port,
      instance3_api,
      
      instance4_id,
      instance4_status,
      instance4_url,
      enable_url4,
      disable_url4,
      instance4_port,
      instance4_api,
    };
  },
});