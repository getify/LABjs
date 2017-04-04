"use strict";

QUnit.test( "load a script", function test(assert){
	var done = assert.async();
	assert.expect( 1 );

	var { logs, log, error } = collectLogs();

	// only replace globals in node (fails in browser)
	$DOM.replaceGlobals = (typeof window == "undefined");
	$DOM( {
		sequentialIds: true,
		log,
		error,
		location: "http://some.tld/",
		resources: [
			{ url: "http://some.tld/a.js", preloadDelay: 10, preload: true, loadDelay: 5, load: true }
		]
	} );

	var $LAB = get$LAB();

	$LAB
	.script( "a.js" )
	.wait( function(){
		assert.ok( true, "a.js" );
		// console.log(logs);
		done();
	} );
} );







// ************************************

function collectLogs() {
	var logs = [];
	return {
		logs,
		log(msg){ logs.push( msg ); },
		error(msg) { logs.push( msg ); },
	};
}
