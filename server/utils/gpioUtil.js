'use strict';

var gpio = require('rpi-gpio');
var _ = require('lodash');

var STATUS = require('../constants/status');

var gpiosLedArray = [
  {red: 12, green: 16, blue:18},
  {red: 22, green: 32, blue:36},
  {red: 11, green: 13, blue:15},
];
var gpioBip = 40;

var init = function() {
  gpio.setMode(gpio.MODE_RPI);
  _.each(gpiosLedArray, function(gpiosLed) {
    gpio.setup(gpiosLed.red, gpio.DIR_OUT, function(ret) {
      gpio.write(gpiosLed.red, false);
    });
    gpio.setup(gpiosLed.green, gpio.DIR_OUT, function(ret) {
      gpio.write(gpiosLed.green, false);
    });
    gpio.setup(gpiosLed.blue, gpio.DIR_OUT, function(ret) {
      gpio.write(gpiosLed.blue, false);
    });
  });
};

var stop = function(process) {
  gpio.destroy(function() {
    console.log('All pins unexported');
    process.exit();
  });
};

var setLed = function(pin, status) {
  switch (status) {
    case STATUS.SUCCESS:
      gpio.write(pin.green, true);
      gpio.write(pin.red, false);
      gpio.write(pin.blue, false);
      break;
    case STATUS.FAILED:
      gpio.write(pin.green, false);
      gpio.write(pin.cdred, true);
      gpio.write(pin.blue, false);
      break;
    case STATUS.RUNNING:
      gpio.write(pin.green, false);
      gpio.write(pin.red, false);
      gpio.write(pin.blue, true);
      break;
    case STATUS.EMPTY:
      gpio.write(pin.green, false);
      gpio.write(pin.red, false);
      gpio.write(pin.blue, false);
      break;
  }
};

var setLeds = function(statusArray) {
  _.each(statusArray, function(status, index) {
    if (index >= gpiosLedArray.length) { return false; }
    console.log(status.build, index);
    switch (status.build) {
      case STATUS.NO_TESTS:
      case STATUS.FIXED:
      case STATUS.SUCCESS:
        setLed(gpiosLedArray[index], STATUS.SUCCESS);
        break;
      case STATUS.FAILED:
        setLed(gpiosLedArray[index], STATUS.FAILED);
        break;
      case STATUS.RUNNING:
        setLed(gpiosLedArray[index], STATUS.RUNNING);
        break;
    };
  });

  for (var i = statusArray.length; i < gpiosLedArray.length; i++) {
    console.log('empty', i);
    setLed(gpiosLedArray[i], STATUS.EMPTY);
  }
};

var setBip = function(bool) {
  // gpio.write(gpioBip, bool);
};

exports.init = init;
exports.stop = stop;
exports.setLeds = setLeds;
exports.setBip = setBip;
