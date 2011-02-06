/*! LAB.js (LABjs :: Loading And Blocking JavaScript)
    v2.0a (c) Kyle Simpson
    MIT License
*/

(function(global){
	var _UseCachePreload = "UseCachePreload",			// constants for the valid keys of the options object
		_UseLocalXHR = "UseLocalXHR",
		_UsePreloading = "UsePreloading",
		_AlwaysPreserveOrder = "AlwaysPreserveOrder",
		_AllowDuplicates = "AllowDuplicates",
		_BasePath = "BasePath",
		
		queue = [],
		scripts = [],
		script_registry = {},
		global_defaults = {}
	;
	
	global_defaults[_UseCachePreload] = true;
	global_defaults[_UseLocalXHR] = true;
	global_defaults[_UsePreloading] = true;
	global_defaults[_AlwaysPreserveOrder] = false;
	global_defaults[_AllowDuplicates] = true;
	global_defaults[_BasePath] = "";
	
	function script(chain_id,chain_opts) {
	}
	
	function wait(chain_id,chain_opts) {
	}
	
	function merge_opts(source,target) {
		for (var k in global_defaults) { if (global_defaults.hasOwnProperty(k)) {
			if (k in source) {
				target[k] = source[k];
				if (k != _BasePath) target[k] = !(!target[k]);
			}
		}}
		return target;
	}
	
	function create_chain() {
		var chain_id = scripts.length
			publicAPI,
			chain_opts = merge_opts(global_defaults,{})
		;
		
		scripts[chain_id] = [];
		
		publicAPI = {
			setOptions:function(opts) {
				merge_opts(opts,chain_opts);
				return publicAPI;
			},
			script:function(){
				var args = [].slice.call(arguments);
				args.unshift(chain_id,chain_opts);
				script.apply(null,args);
				return publicAPI;
			},
			wait:function(){
				var args = [].slice.call(arguments);
				args.unshift(chain_id,chain_opts);
				wait.apply(null,args);
				return publicAPI;
			}
		};
		return publicAPI;
	}
	
	global.$LAB = {
		setGlobalDefaults:function(opts){
			merge_opts(opts,global_defaults);
			return global.$LAB;
		},
		setOptions:function(){
			return create_chain().setOptions.apply(null,arguments);
		},
		script:function(){
			return create_chain().script.apply(null,arguments);
		},
		queueScript:function(){
			queue[queue.length] = {type:"script", args:[].slice.call(arguments)};
			return global.$LAB;
		},
		queueWait:function(){
			queue[queue.length] = {type:"wait", args:[].slice.call(arguments)};
			return global.$LAB;
		},
		runQueue:function(){
			var $L = global.$LAB, len=queue.length, i=len, val;
			for (;--i>=0;) {
				val = queue.shift();
				$L = $L[val.type].apply(null,val.args);
			}
			return $L;
		}
	};
	
})(window);