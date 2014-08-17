/*
 * Freemason build script.
 * 
 * Freemason can be installed by "npm install freemason"
 * or from GitHub at https://....git
 */

var build = require('freemason').tasks;

var outFile = 'dist/jsrequire.min.js';
var sourceFiles = [
    'lib_src/LABjs/LAB.src.js',
    'src/jsrequire.js',
];
var creditsFile = 'src/credits.txt';

build.concatenate(sourceFiles);
build.minify();
build.attribute(creditsFile);
build.write(outFile);
