/*! LAB.js (LABjs :: Loading And Blocking JavaScript)
    v2.0a (c) Kyle Simpson
    MIT License
*/

(function(global){
	var _$LAB = global.$LAB,
	
		// constants for the valid keys of the options object
		_UseLocalXHR = "UseLocalXHR",			
		_AlwaysPreserveOrder = "AlwaysPreserveOrder",
		_AllowDuplicates = "AllowDuplicates",
		_BasePath = "BasePath",
		
		// stateless variables used across all $LAB instances
		root_page = /^[^?#]*\//.exec(location.href)[0],
		root_domain = /^\w+\:\/\/\/?[^\/]+/.exec(root_page)[0],
		append_to = document.head || document.getElementsByTagName("head"),

		// inferences... ick, but still necessary
		opera_or_gecko = (global.opera && Object.prototype.toString.call(global.opera) == "[object Opera]") || ("MozAppearance" in document.documentElement.style),

		// feature sniffs (yay!)
		test_script_elem = document.createElement("script"),
		script_async = test_script_elem.async === true, // http://wiki.whatwg.org/wiki/Dynamic_Script_Execution_Order
		script_preload = test_script_elem.preload || (test_script_elem.readyState && test_script_elem.readyState == "uninitialized") // will a script preload with `src` set before DOM append?
	;

	// test for function
	function is_func(func) { return Object.prototype.toString.call(func) == "[object Function]"; }

	// test for array
	function is_array(arr) { return Object.prototype.toString.call(arr) == "[object Array]"; }

	// test if script URL is on same domain as page or not
	function same_domain(src) { return (canonical_uri(src).indexOf(root_domain) == 0); }

	// make script URL absolute/canonical
	function canonical_uri(src,base_path) {
		var protocol_relative_regex = /^\/\/[^\/]/, absolute_regex = /^\w+\:\/\//;

		// if `src` is protocol-relative, prepend protocol
		if (protocol_relative_regex.test(src)) {
			src = location.protocol + src;
		}
		// otherwise, if `src` not an absolute URL
		else if (!absolute_regex.test(src)) {
			if (base_path != null) {
				base_path = (absolute_regex.test(base_path)) ?
					// `base_path` already absolute (canonical)
					base_path :
					// canonicalize `base_path` as well
					// leading '/' in `base_path` means domain-relative path, otherwise page-relative path
					canonical_uri(base_path,base_path[0] == "/" ? root_domain : root_page)
				;
				// prepend `src` with canonicalized `base_path`
				src = base_path + src;
			}
		}
		return src;
	}

	// merge `source` into `target`
	function merge_objs(source,target) {
		for (var k in source) { if (source.hasOwnProperty(k)) {
			target[k] = source[k]; // TODO: does this need to be recursive for our purposes?
		}}
	}

	// does the chain group have any ready-to-execute scripts?
	function check_chain_group_scripts_ready(chain_group) {
		var any_scripts_ready = false;
		for (var i=0; i<chain_group.scripts.length; i++) {
			if (chain_group.scripts[i].ready && chain_group.scripts[i].exec_trigger) {
				any_scripts_ready = true;
				chain_group.scripts[i].exec_trigger();
				chain_group.scripts[i].exec_trigger = null;
			}
		}
		return any_scripts_ready;
	}

	// is the chain group complete yet?
	function check_chain_group_complete(chain_group) {
		for (var i=0; i<chain_group.scripts.length; i++) {
			if (!chain_group.scripts[i].finished) return false;
		}
		chain_group.scripts[i].finished = true;
		return true;
	}
	
	// create a clean instance of $LAB
	function sandbox() {
		var global_defaults = {},
			use_preloading = true,
			queue = [],
			script_registry = {},
			instanceAPI
		;

		// global defaults
		global_defaults[_UseLocalXHR] = true;
		global_defaults[_AlwaysPreserveOrder] = false;
		global_defaults[_AllowDuplicates] = true;
		global_defaults[_BasePath] = "";
		
		function execute_preloaded_script(script_obj,chain_group,script_registry_item) {
			script_registry_item.ready = script_registry_item.finished = true;
		}

		function do_script(chain_opts,script_obj,chain_group) {
			var script_registry_item,
				ready_cb = function(){ script_obj.ready_cb(script_obj,chain_group,function(){ execute_preloaded_script(script_obj,chain_group,script_registry_item); }); },
				finished_cb = function(){ script_obj.finished_cb(script_obj,chain_group); }
			;

			script_obj.src = canonical_uri(script_obj.src,chain_opts[_BasePath]);
			script_obj.async = script_obj.async || false;

			if (!script_registry[script_obj.src]) script_registry[script_obj.src] = [];

			// allowing duplicates, or is this the first recorded load of this script?
			if (chain_opts[_AllowDuplicates] || script_registry[script_obj.src].length == 0) {
				script_registry_item = script_registry[script_obj.src][script_registry[script_obj.src].length] = {
					ready:false,
					finished:false,
					ready_listeners:[ready_cb],
					finished_listeners:[finished_cb]
				};
				
				if (chain_group.preload) {
				}
			}
			else {
				script_registry_item = script_registry[script_obj.src][0];
				if (script_registry_item.finished) {
					setTimeout(finished_cb,0);
				}
				else if (script_registry.ready) {
					setTimeout(ready_cb,0);
				}
				else {
					script_registry_item.ready_listeners.push(ready_cb);
					script_registry_item.finished_listeners.push(finished_cb);
				}
			}
		}

		// creates a closure for each separate $LAB chain, to keep state cleanly separated between chains
		function create_chain() {
			var chainedAPI,
				chain_opts = merge_objs(global_defaults,{}),
				chain = [],
				exec_cursor = 0,
				scripts_currently_loading = false,
				group
			;
			
			function script_ready(script_obj,chain_group,exec_trigger) {
				script_obj.ready = true;
				script_obj.exec_trigger = exec_trigger;
				check_chain_group_scripts_ready(chain_group);
			}

			function script_executed(script_obj,chain_group) {
				script_obj.ready = script_obj.finished = true;
				script_obj.exec_trigger = null;
				if (check_chain_group_complete(chain_group)) {
					advance_exec_cursor();
				}
			}

			// main driver for executing each part of the chain
			function advance_exec_cursor() {
				while (exec_cursor < chain.length) {
					if (is_func(chain[exec_cursor])) {
						try { chain[exec_cursor](); } catch (err) { } // TODO: wire up error logging
					}
					else if (!chain[exec_cursor].finished) {
						if (check_chain_group_scripts_ready(chain[exec_cursor])) continue;
						break;
					}
					exec_cursor++;
				}
				// we've reached the end of the chain (so far)
				if (exec_cursor == chain.length) {
					scripts_currently_loading = false;
					group = false;
				}
			}

			chainedAPI = {
				script:function(){
					if (!group || !group.scripts) {
						chain.push(group = {scripts:[],finished:true,preload:scripts_currently_loading});
					}
					scripts_currently_loading = true;
					for (var i=0; i<arguments.length; i++) {
						(function(script_obj,script_list){
							if (is_array(script_obj)) {
								script_list = [script_obj];
							}
							for (var j=0; j<script_list.length; j++) {
								script_obj = script_list[j];
								
								if (is_func(script_obj)) script_obj = script_obj();
								if (is_array(script_obj)) {
									var splice_args = [].slice.call(script_obj);
									splice_args.push(j,1);
									script_list.splice.call(script_list,splice_args);
									j--;
									continue;
								}
								if (typeof script_obj == "string") script_obj = {src:script_obj};
								script_obj = merge_objs(script_obj,{
									ready:false,
									ready_cb:script_ready,
									finished:false,
									finished_cb:script_executed
								});
								group.finished = false;
								group.scripts.push(script_obj);
								do_script(chain_opts,script_obj,group);
								
								if (chain_opts[_AlwaysPreserveOrder]) chainedAPI.wait();
							}
						})(arguments[i],arguments[i]);
					}
					return chainedAPI;
				},
				wait:function(){
					if (arguments.length > 0) {
						for (var i=0; i<arguments.length; i++) {
							chain.push(arguments[i]);
						}
						group = chain[chain.length-1];
					}
					else group = false;
					
					if (is_func(chain[exec_cursor])) advance_exec_cursor();
					
					return chainedAPI;
				}
			};

			return chainedAPI;
		}

		instanceAPI = {
			setGlobalDefaults:function(opts){
				merge_objs(opts,global_defaults);
				return instanceAPI;
			},
			setOptions:function(){
				return create_chain().setOptions.apply(null,arguments);
			},
			script:function(){
				return create_chain().script.apply(null,arguments);
			},
			wait:function(){
				return create_chain().wait.apply(null,arguments);
			},
			// built-in queuing for $LAB `script()` and `wait()` calls
			// useful for building up a chain programmatically across various script locations, and simulating
			// execution of the chain
			queueScript:function(){
				queue[queue.length] = {type:"script", args:[].slice.call(arguments)};
				return instanceAPI;
			},
			queueWait:function(){
				queue[queue.length] = {type:"wait", args:[].slice.call(arguments)};
				return instanceAPI;
			},
			runQueue:function(){
				var $L = instanceAPI, len=queue.length, i=len, val;
				for (;--i>=0;) {
					val = queue.shift();
					$L = $L[val.type].apply(null,val.args);
				}
				return $L;
			},
			// rollback `[global].$LAB` to what it was before this file was loaded, return this instance of $LAB
			noConflict:function(){
				global.$LAB = _$LAB;
				return instanceAPI;
			},
			// create another clean instance of $LAB
			sandbox:function(){
				return sandbox();
			}
		};

		return instanceAPI;
	}

	// create the main instance of $LAB
	global.$LAB = sandbox();

})(this);