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
var https = require('https');
var sslConfig = require('./ssl-config');

var app = module.exports = loopback();
var options = {
  key: sslConfig.privateKey,
  cert: sslConfig.certificate
};

app.start = function() {
  var server = https.createServer(options, app);

  server.listen(app.get('port'), function() {
    var baseUrl = 'https://' + app.get('host') + ':' + app.get('port');
    console.log('LoopBack server listening @ %s%s', baseUrl, '/');
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
  return server;
};

// ROUTES
var branch3 = false;
setInterval(function() {
  if(branch3) {
    bluebird.all([
      apiUtil.getGithubPR(),
      apiUtil.getCircleCiBuilds(),
    ]).then(function(responses) {
      var statusArray = _.intersectionBy(responses[1], responses[0], 'commit');

      gpioUtil.setLeds(statusArray);
    });
  }
},
  2000
);

app.get('/commits', function(req, res) {
  var done = false;
  res.write('<p>Loading</p>');
  var intrCommits = setInterval(function() {
    if (done) {
      clearInterval(intrCommits);
    } else {
      res.write('. ');
    }
  }, 200)

  bluebird.all([
    apiUtil.getGithubPR(),
    apiUtil.getCircleCiBuilds(),
  ]).then(function(responses) {
    var statusArray = _.intersectionBy(responses[1], responses[0], 'commit');
    done = true;
    res.write('<br/><table><tr><th>commit</th><th>status<th><tr/>');
    _.forEach(statusArray, function(status) {
      res.write('<tr><td>' + status.commit + '</td><td>' + status.build + '</td></tr>');
    });
    res.write('</table>');
    res.end();
  });
});

app.get('/branch1', function(req, res) {
  gpioUtil.setLeds([{commit: '1', build: 'success'}]);
  res.write('<p>Blinking LED</p>');
  setTimeout(function() { gpioUtil.setLeds([]); }, 1000);

  setTimeout(function() { gpioUtil.setLeds([{commit: '1', build: 'success'}]); }, 2000);
  setTimeout(function() { gpioUtil.setLeds([]); }, 3000);

  setTimeout(function() { gpioUtil.setLeds([{commit: '1', build: 'success'}]); }, 4000);
  setTimeout(function() { gpioUtil.setLeds([]); res.write('<p>Done</p>'); res.end();}, 5000);
});

app.get('/branch2', function(req, res) {
  res.write('<p>Blinking all LED</p>');
  gpioUtil.setLeds([
    { commit: '1', build: 'success' }, { commit: '2', build: 'success' }, { commit: '3', build: 'success' },
  ]);

  setTimeout(function() { gpioUtil.setLeds([
    { commit: '1', build: 'running' }, { commit: '2', build: 'running' }, { commit: '3', build: 'running' },
  ]); }, 2000);

  setTimeout(function() { gpioUtil.setLeds([
    { commit: '1', build: 'failed' }, { commit: '2', build: 'failed' }, { commit: '3', build: 'failed' },
  ]); }, 4000);

  setTimeout(function() { gpioUtil.setLeds([]); res.write('<p>Done</p>'); res.end();}, 6000);
});

app.get('/branch3', function(req, res) {
  branch3 = !branch3;
});

app.get('/sonar', function(req, res) {
  gpioUtil.getSonarDistance();
  // res.write('<p>work in progress</p>');
  // res.write(gpioUtil.getSonarDistance() + '<br/>');
  // setTimeout(function() {
  //   res.write('<p>work done</p>');
  //   res.end();
  // }, 2000);
});

boot(app, __dirname, function(err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module) {
    app.start();
  }
});
