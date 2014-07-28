var request = require('request');
var Q = require('q');

var jiraFxosURI = "https://issues.apache.org/jira/rest/api/2/search?maxResults=1000" +
  "&jql=project=CB+AND+component=firefoxos+AND+status!=resolved+AND+status!=closed" +
  "&fields=key,summary,status,created,updated,assignee";

module.exports.getJiraFxOsIssues = function () {
  var deferred = Q.defer();

  var options = {
    uri: jiraFxosURI,
    method: 'GET',
    json: true
  };

  request(options, function(err, res, body) {
    if (err) {
      deferred.reject(err);
    }

    if (res && res.statusCode !== 200 && res.statusCode !== 201) {
      deferred.reject('Invalid status code ' + res.statusCode, body);
    }

    deferred.resolve(body);
  });

  return deferred.promise;
};
