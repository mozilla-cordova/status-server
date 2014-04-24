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
    },
    {
        name: 'mozilla-cordova.github.io',
        branch: 'master',
        issuesOnly: true
    },
    {
        name: 'status-server',
        branch: 'master',
        issuesOnly: true
    }
];

// Don't use the official `authenticate` call because it won't accept
// the type of token, when it works just fine with github's 3.0.0 API
github.auth = {
    type: 'token',
    token: settings.token
};

module.exports.fetchIssues = function() {
    return Q.all(repos.map(function(repo) {
        var deferred = Q.defer();

        github.issues.repoIssues({
            user: 'mozilla-cordova',
            repo: repo.name
        }, function(err, issues) {
            if (err) {
                deferred.reject(err);
                return;
            }

            deferred.resolve(issues.map(function(iss) {
                iss.repo = repo.name;
                return iss;
            }));
        });

        return deferred.promise;
    })).then(function (results) {
        var issues = _.flatten(results.map(function (result) {
            return result.valueOf();
        }));

        issues.sort(function(a, b) {
            if (new Date(a.updated_at) < new Date(b.updated_at)) {
                return -1;
            }
            return 1;
        });

        return Q.resolve(issues);
    });
};

module.exports.fetchRepos = function () {

    function getRepoInfo(repo) {
        var promiseCommits = Q.denodeify(github.repos.getCommits);
        var promiseBranches = Q.denodeify(github.repos.getBranches);

        return Q.all([promiseCommits({
            user: 'apache',
            repo: repo.name,
            sha: repo.branch || DEFAULT_BRANCH,
            per_page: 50
        }),
        promiseCommits({
            user: 'mozilla-cordova',
            repo: repo.name,
            sha: repo.branch || DEFAULT_BRANCH,
            per_page: 50
        }),
        promiseBranches({
            user: 'apache',
            repo: repo.name
        }),
        promiseBranches({
            user: 'mozilla-cordova',
            repo: repo.name
        })])
        .spread(function(apacheCommits, mozCommits, apacheBranches, mozBranches) {
            // Search for the most recent common commit
            var commonSha = 0;

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

            // List branches that are not present in apache's
            var topicBranches = mozBranches.filter(function (branch) {
                if (branch.name === "mozilla-dev")
                    return false;

                return !_.find(apacheBranches, { name: branch.name });
            });

            topicBranches = _.flatten(topicBranches, 'name');

            return {
                repo: repo.name,
                status: status,
                topicBranches: topicBranches
            };
        });
    }

    var cordovaRepos = repos.filter(function (repo) {
        return !repo.issuesOnly;
    });

    return Q.all(cordovaRepos.map(getRepoInfo));
};
