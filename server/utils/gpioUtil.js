'use strict';

var Gpio = require('onoff').Gpio
var _ = require('lodash');
var moment = require('moment');

var STATUS = require('../constants/status');

var gpiosLedArray = [
  {red: new Gpio(18, 'low'), green: new Gpio(23, 'low'), blue:new Gpio(24, 'low')},
  {red: new Gpio(25, 'low'), green: new Gpio(12, 'low'), blue:new Gpio(16, 'low')},
  {red: new Gpio(17, 'low'), green: new Gpio(27, 'low'), blue:new Gpio(22, 'low')},
];

var startSonar = false;

var setLed = function(pin, status) {
  switch (status) {
    case STATUS.SUCCESS:
      pin.green.writeSync(1);
      pin.red.writeSync(0);
      pin.blue.writeSync(0);
      break;
    case STATUS.FAILED:
      pin.green.writeSync(0);
      pin.red.writeSync(1);
      pin.blue.writeSync(0);
      break;
    case STATUS.RUNNING:
      pin.green.writeSync(0);
      pin.red.writeSync(0);
      pin.blue.writeSync(1);
      break;
    case STATUS.EMPTY:
      pin.green.writeSync(0);
      pin.red.writeSync(0);
      pin.blue.writeSync(0);
      break;
  }
};

var setLeds = function(statusArray) {
  _.each(statusArray, function(status, index) {
    if (index >= gpiosLedArray.length) { return 0; }
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

var getSonarDistance = function() {
  startSonar = !startSonar;
};

exports.setLeds = setLeds;
exports.getSonarDistance = getSonarDistance;
