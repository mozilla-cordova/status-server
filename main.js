var express = require('express');
var fs = require('fs');
var Q = require('q');
var path = require('path');
var jira = require('./lib/jira.js');
var github = require('./lib/github');

var app = express();
var ISSUES_DIR = path.join(__dirname, 'static');

if (!(process.env.GITHUB_TOKEN && process.env.PORT)) {
  throw('Please set GITHUB_TOKEN and PORT environment variables');
}

app.configure(function() {
  app.use(express.static(ISSUES_DIR));
});

function writeCache() {
  Q.all([github.fetchIssues(), github.fetchRepos(), jira.getJiraFxOsIssues()])
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
try {
  fs.accessSync(ISSUES_DIR)
} catch(e) {
  console.log('DEBUG: creating', ISSUES_DIR);
  try {
    fs.mkdirSync(ISSUES_DIR);
  } catch(err) {
    console.log("ERROR! Can't make the directory!", err);
  }
}

writeCache();

var server = app.listen(process.env.PORT);
var address = server.address();

console.log('Service started at', address.address + ':' + address.port);
