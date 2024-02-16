const Homey = require('homey');
const CAPABILITY_DEBOUNCE = 500;
const PiholeDevice = require('./device');

class PiholeDriver extends Homey.Driver {
  async onInit() {
  }
}

module.exports = PiholeDriver;