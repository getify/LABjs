#!/usr/bin/env node

var fs = require("fs"),
	path = require("path"),
	ugly = require("uglify-js"),
	packageJSON,
	copyrightHeader,
	version,
	year = (new Date()).getFullYear(),

	ROOT_DIR = path.join(__dirname,".."),
	SRC_DIR = path.join(ROOT_DIR,"src"),
	DIST_DIR = path.join(ROOT_DIR,"dist"),

	LIB_SRC = path.join(SRC_DIR,"index.js"),
	LIB_DIST = path.join(DIST_DIR,"LAB.js"),

	result
;

console.log("*** Building Core ***");
console.log(`Building: ${LIB_DIST}`);

try {
	// try to make the dist directory, if needed
	try {
		fs.mkdirSync(DIST_DIR,0o755);
	}
	catch (err) { }

	result = ugly.minify(path.join(SRC_DIR,"index.js"),{
		mangle: {
			keep_fnames: true
		},
		compress: {
			keep_fnames: true
		},
		output: {
			comments: /^!/
		}
	}).code;

	// read version number from package.json
	packageJSON = JSON.parse(
		fs.readFileSync(
			path.join(ROOT_DIR,"package.json"),
			{ encoding: "utf8" }
		)
	);
	version = packageJSON.version;

	// read copyright-header text, render with version and year
	copyrightHeader = fs.readFileSync(
		path.join(SRC_DIR,"copyright-header.txt"),
		{ encoding: "utf8" }
	).replace(/`/g,"");
	copyrightHeader = Function("version","year",`return \`${copyrightHeader}\`;`)( version, year );

	// append copyright-header text
	result = copyrightHeader + result;

	// write dist
	fs.writeFileSync( LIB_DIST, result /* result.code + "\n" */, { encoding: "utf8" } );

	console.log("Complete.");
}
catch (err) {
	console.error(err);
	process.exit(1);
}
