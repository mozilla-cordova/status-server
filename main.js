var express = require('express');
var GitHub = require('github');
var _ = require('lodash');
var fs = require('fs');
var settings = require('./settings');
var Q = require('q');
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
  'cordova-plugin-battery-status',
  'cordova-plugin-file',
  'cordova-plugin-file-transfer',
  'cordova-cli',
  'cordova-mobile-spec'
];

// Don't use the official `authenticate` call because it won't accept
// the type of token, when it works just fine with github's 3.0.0 API
github.auth = {
  type: 'token',
  token: settings.token
};

function fetchIssues() {
  var masterList = [];
  var deferred = Q.defer();

  repos.forEach(function(repo) {
    github.issues.repoIssues({
      user: 'mozilla-cordova',
      repo: repo
    }, function(err, issues) {
      if(err) { 
        deferred.reject(err);
        return;
      }

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

    deferred.resolve(issues);
  }

  return deferred.promise;
}

function fetchRepos() {
  var masterList = [];
  var deferred = Q.defer();

  repos.forEach(function(repo) {
    github.repos.getCommits({
      user: 'apache',
      repo: repo,
      sha: 'dev',
      per_page: 50
    }, function(err, apacheCommits) {
      if(err) {
        deferred.reject(err);
        return;
      }

      github.repos.getCommits({
        user: 'mozilla-cordova',
        repo: repo,
        sha: 'dev',
        per_page: 50
      }, function(err, mozCommits) {
        if(err) {
          deferred.reject(err);
          return;
        }

        // Search for the most recent common commit
        var commonSha;

        apacheCommits.some(function(commit) {
          mozCommits.some(function(commit2) {
            if(commit.sha === commit2.sha) {
              commonSha = commit.sha;
              return true;
            }
          });

          return commonSha;
        });

        var status = [];
        if(commonSha !== apacheCommits[0].sha) {
          status.push('out-of-date');
        }

        if(commonSha !== mozCommits[0].sha) {
          status.push('new-commits');
        }

        masterList.push({ repo: repo, status: status });

        if(masterList.length === repos.length) {
          deferred.resolve(masterList);
        }
      });
    });
  });

  return deferred.promise;
}

function writeCache() {
  fetchIssues().then(function(issues) {
    fetchRepos().then(function(repos) {
      var json = JSON.stringify({
        issues: issues,
        repos: repos
      });

      fs.writeFile(__dirname + '/static/issues.js',
                   'var CORDOVA_STATUS = ' + json,
                   function() {});

    });
  });


}

// Fetch issues every 10 minutes
setInterval(writeCache, 10 * 60 * 1000);

writeCache();
app.listen(settings.port);
