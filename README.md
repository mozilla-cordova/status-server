
This is just a simple node server that aggregates details about all
the repos within the `mozilla-cordova` org. It uses the github API and
generates a js file every 5 minutes.

## Setup
* Clone repo
* ``npm install``
* ``cp settings-dist.js settings.js``
* Create [personal github API token](https://github.com/blog/1509-personal-api-tokens)
* Edit settings and add that token
* ``node main.js``
