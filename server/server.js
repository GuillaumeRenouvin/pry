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
var gpioLed = 18;
var gpioBip = 7;
var isLedActive = true;

// INIT GPIO
gpio.setMode(gpio.MODE_BCM);
gpio.setup(gpioLed, gpio.DIR_OUT, function() {
  gpio.write(gpioLed, isLedActive);
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

// ROUTES
app.get('/commits', function(req, res) {
  bluebird.all([
    getGithubPR(optionsGithub),
    getCircleCiBuilds(optionsCircleCi),
  ]).then(function(responses) {
    var statusArray = _.intersectionBy(responses[1], responses[0], 'commit');

    // GPIO
    isLedActive = !isLedActive;
    gpio.write(gpioLed, isLedActive);

    gpio.write(gpioBip, true);
    setTimeout(function() {
      gpio.write(gpioBip, false);
    }, 2000);

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
