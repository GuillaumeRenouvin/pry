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
var gpio = require('pi-gpio');

// VARIABLE
var STATUS = require('./constants/status');
var URLS = require('./constants/urls');
var gpiosLedArray = [
  {red: 1, green: 2},
  {red: 3, green: 4},
  {red: 5, green: 6},
];
var gpioBip = 7;

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
var writeGpio = function(gpio, bool) {
  gpio.open(gpio, 'output', function(err) {
    gpio.write(gpio, bool, function() {
      gpio.close(gpio);
    });
  });
};

var setLed = function(gpio, status) {
  switch (status) {
    case STATUS.SUCCESS:
      writeGpio(gpio.green, true);
      writeGpio(gpio.red, false);
      break;
    case STATUS.FAIL:
      writeGpio(gpio.green, false);
      writeGpio(gpio.red, true);
      break;
    case STATUS.RUNNING:
      writeGpio(gpio.green, true);
      writeGpio(gpio.red, true);
      break;
    case STATUS.EMTY:
      writeGpio(gpio.green, false);
      writeGpio(gpio.red, false);
      break;
  }
};

var setLeds = function(statusArray) {
  var gpioIndex = 0;
  _.each(statusArray, function(status, index) {
    if (gpioIndex > gpiosLedArray.length) { return false; }
    switch (status.build) {
      case STATUS.NO_TESTS:
      case STATUS.FIXED:
      case STATUS.SUCCESS:
        setLed(gpiosLedArray[gpioIndex], STATUS.SUCCESS);
        break;
      case STATUS.FAIL:
        setLed(gpiosLedArray[gpioIndex], STATUS.FAIL);
        break;
      case STATUS.RUNNING:
        setLed(gpiosLedArray[gpioIndex], STATUS.RUNNING);
        break;
    };
    gpioIndex = gpioIndex + 1;
  });

  for (var i = gpioIndex; i < 3; i++) {
    setLed(gpiosLedArray[i], STATUS.EMPTY);
  }
};

var setBip = function(bool) {
  writeGpio(gpioBip, bool);
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

    // if (_.difference(newCommits, previousCommits).length !== 0) {
    //   setBip(true);
    //   setTimeout(function() {
    //     setBip(false);
    //   }, 2000);
    // }

    previousCommits = newCommits;
    setLeds(statusArray);
  });
},
  3000
);

// app.get('/commits', function(req, res) {
//   bluebird.all([
//     getGithubPR(optionsGithub),
//     getCircleCiBuilds(optionsCircleCi),
//   ]).then(function(responses) {
//     var statusArray = _.intersectionBy(responses[1], responses[0], 'commit');
//     res.write(JSON.stringify(statusArray));
//     res.end();
//   });
// });

boot(app, __dirname, function(err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});
