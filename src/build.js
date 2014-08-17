/*
 * Helpers
 */
console.time( 'Execution time' );

var buffer = null;

/* Task Management */
var taskQueue = [];
function queueTask( action, args ) {
    //console.log( action, args );
    taskQueue.push({
        action: action,
        args: args
    });
}

function taskDone() {
    nextTask();
}

function nextTask() {
    if( taskQueue.length === 0 ) {
        console.info( 'Done!' );
    }
    else {
        var task = taskQueue.shift();
        task.action.apply( this, task.args );
    }
}

// wait for blocking code to execute, then process queue
setTimeout(
        function() {
            nextTask();
        }, 0 );

/* Exit Statements */
process.on( 'exit', function( code ) {
    console.timeEnd( 'Execution time' );
});

/* Exports */
module.exports = {
    'buffer': buffer,
    'queueTask': queueTask,
    'taskDone': taskDone,
}

/* Tasks */
module.exports.tasks = require( './tasks' );
