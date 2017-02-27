'use strict';

// IMPORT
var loopback = require('loopback');
var bluebird = require('bluebird');
var boot = require('loopback-boot');
var bodyParser = require('body-parser');
var fs = require('fs');
var _ = require('lodash');
var apiUtil = require('./utils/apiUtil.js');
var gpioUtil = require('./utils/gpioUtil.js');

var app = module.exports = loopback();

app.start = function() {
  return app.listen(function() {
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);

    gpioUtil.init();
  });
};

// ROUTES
var previousCommits = [];
setInterval(function() {
  bluebird.all([
    apiUtil.getGithubPR(),
    apiUtil.getCircleCiBuilds(),
  ]).then(function(responses) {
    var statusArray = _.intersectionBy(responses[1], responses[0], 'commit');
    var newCommits = _.map(statusArray, function(status) {
      return status.commit;
    });

    if (_.difference(newCommits, previousCommits).length !== 0) {
      gpioUtil.setBip(true);
      setTimeout(function() {
        gpioUtil.setBip(false);
      }, 2000);
    }

    previousCommits = newCommits;
    gpioUtil.setLeds(statusArray);
  });
},
  3000
);

app.get('/commits', function(req, res) {
  bluebird.all([
    apiUtil.getGithubPR(),
    apiUtil.getCircleCiBuilds(),
  ]).then(function(responses) {
    var statusArray = _.intersectionBy(responses[1], responses[0], 'commit');
    res.write(JSON.stringify(statusArray));
    res.end();
  });
});

app.get('/sonar', function(req, res) {
  res.write('sonar');
  res.end();
});

process.on('SIGINT', function() {
  gpioUtil.stop(process);
});

boot(app, __dirname, function(err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module) {
    app.start();
  }
});
