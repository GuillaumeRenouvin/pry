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
var gpiosLedArray = [ 18, 24, 12];
var gpioBip = 7;

// INIT GPIO
gpio.setMode(gpio.MODE_BCM);
_.each(gpiosLedArray, function(gpiosLed) {
  gpio.setup(gpiosLed gpio.DIR_OUT, function() {
    gpio.write(gpiosLed.red, true);
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
      gpio.write(pin, false);
      break;
    case STATUS.FAILURE:
      gpio.write(pin, true);
      break;
  }
};

var setLeds = function(statusArray) {
  _.each(statusArray, function(status, index) {
    if (index > gpiosLedArray.length) { return false; }
    switch (status.build) {
      case STATUS.NO_TESTS:
      case STATUS.FIXED:
      case STATUS.SUCCESS:
        setLed(gpiosLedArray[index], STATUS.SUCCESS);
        break;
      case STATUS.FAILED:
      case STATUS.RUNNING:
        setLed(gpiosLedArray[index], STATUS.FAILURE);
        break;
    };
  });

  for (var i = statusArray.length; i < gpiosLedArray.length; i++) {
    setLed(gpiosLedArray[i], STATUS.FAILURE);
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
