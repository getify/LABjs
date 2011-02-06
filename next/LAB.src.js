/*! LAB.js (LABjs :: Loading And Blocking JavaScript)
    v2.0a (c) Kyle Simpson
    MIT License
*/

(function(global){
	var _UseLocalXHR = "UseLocalXHR",			// constants for the valid keys of the options object
		_AlwaysPreserveOrder = "AlwaysPreserveOrder",
		_AllowDuplicates = "AllowDuplicates",
		_BasePath = "BasePath",

		queue = [],
		scripts = [],
		script_registry = {},
		global_defaults = {},
		root_page = /^[^?#]*\//.exec(location.href)[0],
		root_domain = /^\w+\:\/\/\/?[^\/]+/.exec(root_page)[0],

		use_preloading = true,
		append_to = document.head || document.getElementsByTagName("head"),

		// inferences... ick, but still necessary
		opera_or_gecko = (global.opera && Object.prototype.toString.call(global.opera) == "[object Opera]") || ("MozAppearance" in document.documentElement.style),

		// feature sniffs (yay!)
		test_script_elem = document.createElement("script"),
		script_async = test_script_elem.async === true, // http://wiki.whatwg.org/wiki/Dynamic_Script_Execution_Order
		script_preload = test_script_elem.readyState && test_script_elem.readyState == "uninitialized" // will a script preload with `src` set before DOM append?
	;

	// global defaults
	global_defaults[_UseLocalXHR] = true;
	global_defaults[_AlwaysPreserveOrder] = false;
	global_defaults[_AllowDuplicates] = true;
	global_defaults[_BasePath] = "";

	// test for function
	function is_func(func) { return Object.prototype.toString.call(func) == "[object Function]"; }

	// make script URL absolute/canonical
	function canonical_uri(src,base_path) {
		var protocol_relative_regex = /^\/\/[^\/]/, absolute_regex = /^\w+\:\/\//;

		// if `src` is protocol-relative, prepend protocol
		if (protocol_relative_regex.test(src)) {
			src = location.protocol + src;
		}
		// otherwise, if `src` not an absolute URL
		else if (!absolute_regex.test(src)) { 
			// if `base_path` is protocol-relative, prepend protocol
			if (protocol_relative_regex.test(base_path)) {
				base_path = location.protocol + base_path;
			}
			// otherwise, if `base_path` not an absolute URL, prepend with either `domain_root` or `page_root`
			else if (!absolute_regex.test(base_path)) {
				// leading '/' means domain relative path, otherwise page relative path
				base_path = (base_path[0] == "/" ? root_domain : root_page) + base_path;
			}
			// prepend `src` with `base_path`
			src = base_path + src;
		}
		
		return src;
	}

	// check if script URL is on same domain as page or not
	function same_domain(src) { return (canonical_uri(src).indexOf(root_domain) == 0); }

	// merge options 
	function merge_opts(source,target) {
		for (var k in global_defaults) { if (global_defaults.hasOwnProperty(k)) {
			if (k in source) {
				target[k] = source[k];
				if (k != _BasePath) target[k] = !(!target[k]);
			}
		}}
		return target;
	}

	function script(chain_group,chain_opts) {
	}

	function wait(chain_id,chain_opts) {
	}

	function create_chain() {
		var chain_id = scripts.length,
			chain_group_id = 0,
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
				scripts[chain_id][chain_group_id] = scripts[chain_id][chain_group_id] || [];
				args.unshift(scripts[chain_id][chain_group_id],chain_opts);
				script.apply(null,args);
				return publicAPI;
			},
			wait:function(){
				var args = [].slice.call(arguments);
				args.unshift(chain_id,chain_opts);
				wait.apply(null,args);
				chain_group_id++;
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