freemason
=========

Why use a task runner? Why memorize a million conventions? Why create a giant config file to perform elementary tasks, like bundling and minifying JavaScript?

Why not do this instead?

```JavaScript
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
```

That's it! Really, this is all you need to do in order to concatenated a bunch of files, minify/obfuscate the result, put some credits on top, and write it to a file.

Want to write your own tasks? There are only four conventions to keep in mind:

1. `buffer` is used by all tasks implicitly, to store the state of your build.
2. `tasks` contains all the default tasks (currently `concatenate`, `minify`, `attribute`, and `write`).
3. `queueTask` must be used to run a task synchronously, and all calls to `queueTask` must be made within the first execution loop. Don't queue tasks on asynchronous callbacks -- it won't work. Instead, build any asynchronous functionality into the task definition.
4. `taskDone` must be called when the task is complete, in order to move on to the next task.
