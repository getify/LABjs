"use strict";

QUnit.test( "placeholder", function test(assert){
	assert.expect( 1 );
	assert.ok( true, "placeholder" );
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
