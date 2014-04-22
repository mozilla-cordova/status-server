var GitHub = require('github');
var _ = require('lodash');
var settings = require('../settings');
var Q = require('q');

var DEFAULT_BRANCH = 'dev';

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
];

// Don't use the official `authenticate` call because it won't accept
// the type of token, when it works just fine with github's 3.0.0 API
github.auth = {
    type: 'token',
    token: settings.token
};

module.exports.fetchIssues = function() {
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
};

module.exports.fetchRepos = function () {
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
};
