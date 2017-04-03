#!/usr/bin/env node

"use strict";

var path = require("path");

// make timers behave more stably
require("stable-timers").replaceGlobals();

global.$DOM = require("mock-dom-resources");
global.$DOM.replaceGlobals = true;
var win = global.$DOM({ log(){}, error(){} });

// TEMP HACK
win.location = global.location = { href: "https://some.tld/", protocol: "https:", search: "" };

require(path.join("..","src","index.js"));

global.QUnit = require("qunitjs");

require("../tests/qunit.config.js");
require("../tests/tests.js");

QUnit.start();
