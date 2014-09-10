(function(){
    var exportsCache = {}, $LAB;

    require = function(id, callback) {
        // Create a reference to the object that should be populated
        var exports = {};

        $LAB = $LAB // always reset the "playhead"
        .wait(function(){
            $COMMONJS_MODULE = {exports:exports}; //window scope
        })
        .script(id) // assume id is a fully qualified path, for now
        .wait(function(){
            // if cache exists, module already executed
            var populatedExports = exportsCache[id] || $COMMONJS_MODULE.exports;

            // sanitize gobal var
            delete $COMMONJS_MODULE;

            // if exports object has been replaced, copy the properties
            // from the new object in the it.
            // if populatedExports was pulled from cache, it will never be
            // the original exports object.
            if(populatedExports !== exports){
                for(var i in populatedExports){
                    if(populatedExports.hasOwnProperty(i)){
                        exports[i] = populatedExports[i];
                    }
                }
            }

            // set exports cache
            if(!exportsCache[id]) exportsCache[id] = exports;

            callback(id);
        });

        // this will always be populated on callback, even if the reference
        // to exports gets swapped
        return exports;
    };
    wait = require.wait = function() {
        $LAB = $LAB.wait.apply(null,arguments);
    };
})();

