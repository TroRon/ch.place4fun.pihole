const Homey = require('homey');

class PiholeDriver extends Homey.Driver {
  async onInit() {
    this.log("PiholeDriver initialized");
  }
}

module.exports = PiholeDriver;