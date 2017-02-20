'use strict';

// IMPORT
var loopback = require('loopback');
var boot = require('loopback-boot');
var bluebird = require('bluebird');
var bodyParser = require('body-parser');
var config = require('./config/config');
var fs = require('fs');
var https = require('https');
var request = bluebird.promisifyAll(require('request'), {multiArgs: true});
var _ = require('lodash');
var gpio = require('rpi-gpio');

// VARIABLE
var STATUS = require('./constants/status');
var URLS = require('./constants/urls');
var gpiosLedArray = [
  {red: 18, green: 23},
  {red: 24, green: 25},
  {red: 12, green: 16},
];
var gpioBip = 7;

// INIT GPIO
gpio.setMode(gpio.MODE_BCM);
_.each(gpiosLedArray, function(gpiosLed) {
  gpio.setup(gpiosLed.red, gpio.DIR_OUT, function() {
    gpio.write(gpiosLed.red, true);
  });
  gpio.setup(gpiosLed.green, gpio.DIR_OUT, function() {
    gpio.write(gpiosLed.green, true);
  });
});

var optionsGithub = {
  url: URLS.GITHUB + config.user + '/' + config.repo + '/pulls?state=open',
  headers: {
    'Authorization': 'token ' + config.github.token,
    'User-Agent': config.user,
    'Accept': 'application/json',
  },
};
var optionsCircleCi = {
  url: URLS.CIRCLECI + config.user + '/' + config.repo + '?circle-token=' +
  config.circleci.token + '&limit=100',
  headers: {
    'Accept': 'application/json',
  },
};

var app = module.exports = loopback();

app.start = function() {
  return app.listen(function() {
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
  });
};

// FUNCTIONS
var getGithubPR = function(optionsGithub) {
  return request.getAsync(optionsGithub).spread(function(response, body) {
    var pullsRequests = [];
    if (response.statusCode == 200) {
      try {
        pullsRequests = JSON.parse(body);
        pullsRequests = _.map(pullsRequests, function(pullRequest) {
          return {commit: pullRequest.head.sha};
        });
      } catch (e) {
        return [];
      }
    }
    return pullsRequests;
  });
};

var getCircleCiBuilds = function(optionsCircleCi) {
  return request.getAsync(optionsCircleCi).spread(function(response, body) {
    var builds = [];
    if (response.statusCode == 200) {
      try {
        var buildsResponse = JSON.parse(body);
        _.map(buildsResponse, function(build) {
          builds.push(
            {commit: build.all_commit_details[0].commit, build: build.status}
          );
        });
      } catch (e) {
        return [];
      }
    }
    return builds;
  });
};

// GPIO
var setLed = function(pin, status) {
  switch (status) {
    case STATUS.SUCCESS:
      gpio.write(pin.green, false);
      gpio.write(pin.red, true);
      break;
    case STATUS.FAILED:
      gpio.write(pin.green, true);
      gpio.write(pin.red, false);
      break;
    case STATUS.RUNNING:
      gpio.write(pin.green, false);
      gpio.write(pin.red, false);
      break;
    case STATUS.EMPTY:
      gpio.write(pin.green, true);
      gpio.write(pin.red, true);
      break;
  }
};

var setLeds = function(statusArray) {
  _.each(statusArray, function(status, index) {
    if (index > gpiosLedArray.length) { return false; }
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
  gpio.write(gpioBip, bool);
};

// ROUTES
var previousCommits = [];
setInterval(function() {
  bluebird.all([
    getGithubPR(optionsGithub),
    getCircleCiBuilds(optionsCircleCi),
  ]).then(function(responses) {
    var statusArray = _.intersectionBy(responses[1], responses[0], 'commit');
    var newCommits = _.map(statusArray, function(status) {
      return status.commit;
    });

    if (_.difference(newCommits, previousCommits).length !== 0) {
      setBip(true);
      setTimeout(function() {
        setBip(false);
      }, 2000);
    }

    previousCommits = newCommits;
    setLeds(statusArray);
  });
},
  3000
);

app.get('/commits', function(req, res) {
  bluebird.all([
    getGithubPR(optionsGithub),
    getCircleCiBuilds(optionsCircleCi),
  ]).then(function(responses) {
    var statusArray = _.intersectionBy(responses[1], responses[0], 'commit');
    res.write(JSON.stringify(statusArray));
    res.end();
  });
});

process.on('SIGINT', function() {
  gpio.destroy(function() {
    console.log('All pins unexported');
    process.exit();
  });
});

boot(app, __dirname, function(err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module) {
    app.start();
  }
});
