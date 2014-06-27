# Mozilla Cordova status server

This is a node server used by [the Mozilla Cordova status site](https://github.com/mozilla-cordova/mozilla-cordova.github.io) (hosted [here](http://mozilla-cordova.github.io/status/index.html)) to
populate repository and issues information. It aggregates details about relevant Cordova repos in the `apache` and `mozilla-cordova` orgs.
It uses the [github API](https://developer.github.com/v3/) and [jira's rest API](https://docs.atlassian.com/jira/REST/latest/) to gather issues and pull requests data.

## Setup
* Clone repo
* ``npm install``
* ``cp settings-dist.js settings.js``
* Create [personal github API token](https://github.com/blog/1509-personal-api-tokens)
* Edit settings and add that token
* ``node main.js``


## Stackato Hosting

The service is currently being hosted on Mozilla's paas service using stackato at http://mozilla-cordova.paas.allizom.org/issues.js.
For more information on stackato, [see the documentation](https://api.paas.allizom.org/docs/). For instructions on how to set up
Mozilla stackato account [see the wiki (requires Mozilla's LDAP access)](https://mana.mozilla.org/wiki/pages/viewpage.action?pageId=30081453).
