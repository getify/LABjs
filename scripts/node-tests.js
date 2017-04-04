#!/usr/bin/env node

"use strict";

global.QUnit = require("qunitjs");
var path = require("path");
var freshy = require("freshy");

// make timers behave more stably
require("stable-timers").replaceGlobals();

global.$DOM = require("mock-dom-resources");

global.get$LAB = get$LAB;

require("../tests/qunit.config.js");
require("../tests/tests.js");

QUnit.start();


// **********************************

function get$LAB() {
	return freshy.reload(path.join("..","src","index.js")).$LAB;
}
