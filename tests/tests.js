"use strict";

QUnit.test( "load a script", function test(assert){
	var done = assert.async();
	assert.expect( 1 );

	var { logs, log, error } = collectLogs();

	$DOM( {
		replaceGlobals: true,
		sequentialIds: true,
		log,
		error,
		resources: [
			{ url: "http://some.tld/a.js", preloadDelay: 10, preload: true, loadDelay: 5, load: true }
		]
	} );

	var $LAB = get$LAB();

	$LAB
	.setOptions( {BasePath: "http://some.tld/"} )
	.script( "a.js" )
	.wait( function(){
		$DOM.restoreGlobals();
		assert.ok( true, "a.js" );
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
