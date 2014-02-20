var express = require('express');
var GitHub = require('github');
var _ = require('lodash');
var fs = require('fs');
var settings = require('./settings');
var app = express();

app.configure(function() {
  app.use(express.static(__dirname + '/static'));
});

var github = new GitHub({
  version: '3.0.0'
});

var repos = [
  'cordova-plugin-camera',
  'cordova-plugin-vibration',
  'cordova-plugin-geolocation',
  'cordova-plugin-dialogs',
  'cordova-plugin-device',
  'cordova-plugin-device-orientation',
  'cordova-plugin-device-motion',
  'cordova-plugin-contacts',
  'cordova-plugin-battery-status'
];

// Don't use the official `authenticate` call because it won't accept
// the type of token, when it works just fine with github's 3.0.0 API
github.auth = {
  type: 'token',
  token: settings.token
};

function fetchIssues() {
  var masterList = [];

  repos.forEach(function(repo) {
    github.issues.repoIssues({
      user: 'mozilla-cordova',
      repo: repo
    }, function(err, issues) {
      masterList.push(issues.map(function(iss) {
        iss.repo = repo;
        return iss;
      }));

      if(masterList.length == repos.length) {
        done();
      }
    });
  });

  function done() {
    var issues = _.flatten(masterList);

    issues.sort(function(a, b) {
      if(new Date(a.updated_at) < new Date(b.updated_at)) {
        return -1;
      }
      return 1;
    });
    
    fs.writeFile(__dirname + '/static/issues.js',
                 'var CORDOVA_ISSUES = ' + JSON.stringify(issues),
                 function() {});
  }
}

// Fetch issues every 5 minutes
setInterval(fetchIssues, 5 * 60 * 1000);
app.listen(settings.port);
