var GitHub = require('github');
var _ = require('lodash');
var settings = require('../settings');
var Q = require('q');

var PR_USERS = [
    'rodms10',
    'zalun'
];

var github = new GitHub({
    version: '3.0.0'
});

var repos = [
    {
        name: 'cordova-app-hello-world'
    },
    {
        name: 'cordova-cli'
    },
    {
        name: 'cordova-docs'
    },
    {
        name: 'cordova-firefoxos',
        allPRs: true
    },
    {
        name: 'cordova-js'
    },
    {
        name: 'cordova-lib'
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
        name: 'cordova-plugin-globalization'
    },
    {
        name: 'cordova-plugin-inappbrowser'
    },
    {
        name: 'cordova-plugin-media'
    },
    {
        name: 'cordova-plugin-media-capture'
    },
    {
        name: 'cordova-plugin-network-information'
    },
    {
        name: 'cordova-plugin-vibration'
    },
    {
        name: 'cordova-plugman'
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
    return Q.all(
        repos
        .filter(function(repo) {
            // Only track issues on repos with issuesOnly set
            return repo.issuesOnly;
        })
        .map(function(repo) {
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
    })
    .fail(function(error) {
        console.log('Failed fetching issues:', error);
        process.exit(-1);
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
        var promisePR = Q.denodeify(github.pullRequests.getAll);

        return promisePR({
            user: 'apache',
            repo: repo.name,
            state: 'open',
            per_page: 100
        })
        .then(function(apacheRequests) {
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
                apachePullRequests: apachePRs,
                mentionsPullRequests: mentionPRs
            };
        })
        .fail(function(error) {
            console.log('Failed fetching repo', repo.name,'info:', error.message);
            process.exit(-1);
        });
    }

    var cordovaRepos = repos.filter(function (repo) {
        return !repo.issuesOnly;
    });

    return Q.all(cordovaRepos.map(getRepoInfo));
};
