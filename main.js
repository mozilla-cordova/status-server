var express = require('express');
var GitHub = require('github');
var _ = require('lodash');
var fs = require('fs');
var settings = require('./settings');
var Q = require('q');
var path = require('path');
var jira = require('./lib/jira.js');

var app = express();
var DEFAULT_BRANCH = 'dev';
var ISSUES_DIR = path.join(__dirname, 'static');

app.configure(function() {
  app.use(express.static(ISSUES_DIR));
});

var github = new GitHub({
  version: '3.0.0'
});

var repos = [
  {
    name: 'cordova-plugin-camera'
  },
  {
    name: 'cordova-plugin-vibration'
  },
  {
    name: 'cordova-plugin-geolocation'
  },
  {
    name: 'cordova-plugin-dialogs'
  },
  {
    name: 'cordova-plugin-device'
  },
  {
    name: 'cordova-plugin-device-orientation'
  },
  {
    name: 'cordova-plugin-device-motion'
  },
  {
    name: 'cordova-plugin-contacts'
  },
  {
    name: 'cordova-plugin-battery-status'
  },
  {
    name: 'cordova-plugin-file'
  },
  {
    name: 'cordova-plugin-file-transfer'
  },
  {
    name: 'cordova-plugin-network-information'
  },
  {
    name: 'cordova-cli',
    branch: 'master'
  },
  {
    name: 'cordova-firefoxos',
    branch: 'master'
  },
  {
    name: 'cordova-mobile-spec',
    branch: 'master'
  }
].sort(function(a, b) {
    return a.name.localeCompare(b.name);
  });

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
      repo: repo.name
    }, function(err, issues) {
      if (err) {
        deferred.reject(err);
        return;
      }

      masterList.push(issues.map(function(iss) {
        iss.repo = repo.name;
        return iss;
      }));

      if (masterList.length == repos.length) {
        done();
      }
    });
  });

  function done() {
    var issues = _.flatten(masterList);

    issues.sort(function(a, b) {
      if (new Date(a.updated_at) < new Date(b.updated_at)) {
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
      repo: repo.name,
      sha: repo.branch || DEFAULT_BRANCH,
      per_page: 50
    }, function(err, apacheCommits) {
      if (err) {
        console.log('[' + repo.name + '] ' + err);
        masterList.push({ repo: repo.name, status: [] });
        return;
      }

      github.repos.getCommits({
        user: 'mozilla-cordova',
        repo: repo.name,
        sha: repo.branch || DEFAULT_BRANCH,
        per_page: 50
      }, function(err, mozCommits) {
        if (err) {
          masterList.push({ repo: repo.name, status: [] });
          return;
        }

        // Search for the most recent common commit
        var commonSha;

        apacheCommits.some(function(commit) {
          mozCommits.some(function(commit2) {
            if (commit.sha === commit2.sha) {
              commonSha = commit.sha;
              return true;
            }
          });

          return commonSha;
        });

        var status = [];
        if (commonSha !== apacheCommits[0].sha) {
          status.push('out-of-date');
        }

        if (commonSha !== mozCommits[0].sha) {
          status.push('new-commits');
        }

        masterList.push({ repo: repo.name, status: status });

        if (masterList.length === repos.length) {
          deferred.resolve(masterList);
        }
      });
    });
  });

  return deferred.promise;
}

function writeCache() {
  Q.all([fetchIssues(), fetchRepos(), jira.getJiraFxOsIssues()])
    .spread(function(issues, repos, jiraIssues) {
      var issuesJson = JSON.stringify({
        issues: issues,
        repos: repos
      });

      fs.writeFile(path.join(ISSUES_DIR, 'issues.js'),
          'var CORDOVA_STATUS = ' + issuesJson +
          '\nvar JIRA_ISSUES = ' + JSON.stringify(jiraIssues));
    });
}

// Fetch issues every 10 minutes
setInterval(writeCache, 10 * 60 * 1000);

// Create issues folder if it does not exist
if (!fs.existsSync(ISSUES_DIR)) {
  fs.mkdirSync(ISSUES_DIR, function(err) {
    if (err) {
      console.log("ERROR! Can't make the directory!", err);
    }
  });
}

writeCache();
app.listen(process.env.PORT || settings.port);
