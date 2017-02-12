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

// VARIABLE
var STATUS = require('./constants/status');
var URLS = require('./constants/urls');

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
  request.getAsync(optionsGithub).spread(function(response, body) {
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
  var builds = [];
  request.getAsync(optionsCircleCi).spread(function(response, body) {
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

var setLed = function(statusArray) {
  _.each(statusArray, function(status, index) {
    switch (status.status) {
      case STATUS.SUCCESS: console.log('success');
      case STATUS.FAIL: console.log('fail');
      case STATUS.RUNNING: console.log('running');
    };
  });
};

// ROUTES
// // CODE
// setInterval(function() {
//   bluebird.all([
//     getGithubPR(optionsGithub),
//     getCircleCiBuilds(optionsCircleCi)
//   ]).then(function(responses) {
//     statusArray = _.intersectionBy(responses[1], responses[0], 'commit');
//     setLed(statusArray);
//   }),
//   3000
// });

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

boot(app, __dirname, function(err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});
