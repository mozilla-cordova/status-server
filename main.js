var express = require('express');
var fs = require('fs');
var settings = require('./settings');
var Q = require('q');
var path = require('path');
var jira = require('./lib/jira.js');
var github = require('./lib/github');

var app = express();
var ISSUES_DIR = path.join(__dirname, 'static');

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
if (!fs.existsSync(ISSUES_DIR)) {
  fs.mkdirSync(ISSUES_DIR, function(err) {
    if (err) {
      console.log("ERROR! Can't make the directory!", err);
    }
  });
}

writeCache();
app.listen(process.env.PORT || settings.port);

console.log('Service started.');
