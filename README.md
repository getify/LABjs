require
=========
Asynchronous `require()` that is fast and easy to use! This JavaScript loader is based on the super fast and small [LABjs](http://labjs.com/), but functions a lot like Node's require.

##Basic Usage
```JavaScript
require('/path/to/your_script.js', function() {
  GlobalVarDefinedInYourScript.executeFunction();
});  
```
-OR-
```JavaScript
require('/path/to/your_script.js');
wait(function() {
  GlobalVarDefinedInYourScript.executeFunction();
});  
```
All scripts loaded with `require` will always execute synchronously, so if you have dependencies:
```JavaScript
require('/path/to/core.js');
require('/path/to/your_script_depends_on_core.js');
wait(function() {
  GlobalVarDefinedInYourScript.executeFunction();
});  
```
##Requiring Modules
Requiring modules couldn't be simpler!
```JavaScript
var YourModule = require('/path/to/your_module.js', function() {
  YourModule.executeFunction();
});  
```
-OR-
```JavaScript
var YourModule = require('/path/to/your_module.js');
wait(function() {
  YourModule.executeFunction();
});  
```
##Defining Modules
In order to require a module, you must define `module.exports`, just like in Node. The only difference is that you will need to wrap your code in a `function() {}` wrapper to make the scope private, and pass `module` and `exports` arguments into the wrapper:
```JavaScript
(function(module, exports){
    function thisFunctionIsPrivate() {
        // Do stuff
    }
    module.exports = {
        executeFunction: thisFunctionIsPrivate
    }
})($COMMONJS_MODULE, $COMMONJS_MODULE.exports);
```
That's it, you're done! Enjoy!:)
