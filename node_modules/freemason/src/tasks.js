var fs = require( 'fs' );
var build = require( './build' ),
    buffer = build.buffer,
    queueTask = build.queueTask,
    taskDone = build.taskDone;

var tasks = {
    'concatenate': function concatenate( sourceFiles ) {
        console.info( 'Bundling...' );
        var fileBuffers = [];
        var numFilesToRead = { n: 0 };
        for( var idx in sourceFiles ) {
            numFilesToRead.n ++;
            ( function( idx ) {
                fs.readFile( sourceFiles[idx], function( err, data ) {
                    fileReady({
                        'err': err,
                        'data': data,
                        'callback': function() {
                            buffer = Buffer.concat( fileBuffers );
                            console.info( fileBuffers.length + ' files concatenated.' );
                            taskDone();
                        },
                        'idx': idx,
                        'fileBuffers': fileBuffers,
                        'numFilesToRead': numFilesToRead
                    });
                });
            })( idx );
        }
    },

    'minify': function minify() {
        console.info( 'Obfuscating...' );
        var uglify = require( 'uglify-js' );
        var ugly = uglify.minify( buffer.toString(), { fromString: true });
        buffer = new Buffer( ugly.code );
        //console.log( buffer.toString() );
        taskDone();
    },

    'compress': function compress() {
        console.info( 'Compressing...' );
        taskDone();
    },

    'attribute': function attribute( creditsFile ) {
        console.info( 'Attributing...' );
        fs.readFile( creditsFile, function( err, data ) {
            buffer = Buffer.concat([ data, buffer ]);
            taskDone();
        });
    },

    'write': function write( outFile ) {
        console.info( 'Writing file...' );
        fs.writeFile( outFile, buffer, function() {
            console.info( 'Wrote', buffer.length, 'bytes to', outFile );
            taskDone();
        });
    }
}

/* Synchronizers */
function fileReady( args ) {
    var err = args.err,
        data = args.data,
        callback = args.callback,
        idx = args.idx,
        fileBuffers = args.fileBuffers,
        numFilesToRead = args.numFilesToRead;

    if( !err ) {
        //console.log( 'index', idx );
        fileBuffers[ idx ] = data;
        //console.log( numFilesToRead, fileBuffers );

        if( --numFilesToRead.n === 0 ) {
            callback();
        }
        //console.log( numFilesToRead );
    }
    else {
        console.error( err );
    }
}

/* Exports */

for( var task in tasks ) {
    (function( task ) {
        module.exports[ task ] = function() { queueTask( tasks[ task ], arguments )};
    })(task);
}

/*
module.exports = {
    // Replace w/ loop that iterates over tasks
    'concatenate': function( sourceFiles ) { queueTask( tasks.concatenate, sourceFiles ); },
    'minify': function() { queueTask( tasks.minify ); },
    'compress': function() { queueTask( tasks.compress ) },
    'attribute': function( creditsFile ) { queueTask( tasks.attribute, creditsFile ); },
    'write': function( outFile ) { queueTask( tasks.write, outFile ) }
}
*/
