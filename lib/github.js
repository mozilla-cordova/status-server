var GitHub = require('github');
var _ = require('lodash');
var settings = require('../settings');
var Q = require('q');

var DEFAULT_BRANCH = 'master';

var PR_USERS = [
    'rodms10',
    'zalun'
];

var github = new GitHub({
    version: '3.0.0'
});

var repos = [
    {
        name: 'cordova-cli'
    },
    {
        name: 'cordova-firefoxos',
        allPRs: true
    },
    {
        name: 'cordova-mobile-spec'
    },
    {
        name: 'cordova-plugin-battery-status'
    },
    {
        name: 'cordova-plugin-camera'
    },
    {
        name: 'cordova-plugin-contacts'
    },
    {
        name: 'cordova-plugin-device'
    },
    {
        name: 'cordova-plugin-device-motion'
    },
    {
        name: 'cordova-plugin-device-orientation'
    },
    {
        name: 'cordova-plugin-dialogs'
    },
    {
        name: 'cordova-plugin-file'
    },
    {
        name: 'cordova-plugin-file-transfer'
    },
    {
        name: 'cordova-plugin-geolocation'
    },
    {
        name: 'cordova-plugin-inappbrowser'
    },
    {
        name: 'cordova-plugin-network-information'
    },
    {
        name: 'cordova-plugin-vibration'
    },
    {
        name: 'mozilla-cordova.github.io',
        issuesOnly: true
    },
    {
        name: 'status-server',
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
    function mapPullRequestInfo(pr) {
        return {
            title: pr.title,
            url: pr.html_url,
            user: pr.user.login,
            user_url: pr.user.html_url
        };
    }

    function mentionsFirefox(pr) {
        var firefoxMention = ['firefox', 'fxos', 'ffos'];

        var mentioned = firefoxMention.some(function (text) {
            return pr.title.indexOf(text) === 0;
        });

        return mentioned || firefoxMention.some(function (text) {
            return pr.body.indexOf(text) === 0;
        });
    }

    function getRepoInfo(repo) {
        var promiseBranches = Q.denodeify(github.repos.getBranches);
        var promisePR = Q.denodeify(github.pullRequests.getAll);

        return Q.all([
            promiseBranches({
                user: 'apache',
                repo: repo.name
            }),
            promiseBranches({
                user: 'mozilla-cordova',
                repo: repo.name
            }),
            promisePR({
                user: 'apache',
                repo: repo.name,
                state: 'open',
                per_page: 100
            })
        ])
        .spread(function(apacheBranches, mozBranches, apacheRequests) {
            // List branches that are not present in apache's
            var topicBranches = mozBranches.filter(function (branch) {
                if (branch.name === "mozilla-dev")
                    return false;

                return !_.find(apacheBranches, { name: branch.name });
            });

            topicBranches = _.flatten(topicBranches, 'name');

            var apachePRs = apacheRequests.filter(function (pr) {
                return repo.allPRs || PR_USERS.some(function (user) {
                    return pr.head.label.indexOf(user) === 0;
                });
            }).map(mapPullRequestInfo);

            var mentionPRs = apacheRequests.filter(function (pr) {
                return mentionsFirefox(pr);
            }).map(mapPullRequestInfo);

            return {
                repo: repo.name,
                topicBranches: topicBranches,
                apachePullRequests: apachePRs,
                mentionsPullRequests: mentionPRs
            };
        });
    }

    var cordovaRepos = repos.filter(function (repo) {
        return !repo.issuesOnly;
    });

    return Q.all(cordovaRepos.map(getRepoInfo));
};
