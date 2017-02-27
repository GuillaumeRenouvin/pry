'use strict';

var bluebird = require('bluebird');
var request = bluebird.promisifyAll(require('request'), {multiArgs: true});
var _ = require('lodash');
var config = require('../config/config');

var URLS = require('../constants/urls');

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

var getGithubPR = function() {
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

var getCircleCiBuilds = function() {
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

exports.getGithubPR = getGithubPR;
exports.getCircleCiBuilds = getCircleCiBuilds;
