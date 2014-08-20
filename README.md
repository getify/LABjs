require
=========
Asynchronous require that is fast and easy to use!

##Usage
```JavaScript
require('/path/to/your_module.js', function() {
  YourModule.executeFunction();
});  
```
-OR-
```JavaScript
require('/path/to/your_module.js');
wait(function() {
  YourModule.executeFunction();
});  
```
