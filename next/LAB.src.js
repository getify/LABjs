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
		_CacheBust = "CacheBust",
		_BasePath = "BasePath",
		
		// stateless variables used across all $LAB instances
		root_page = /^[^?#]*\//.exec(location.href)[0],
		root_domain = /^\w+\:\/\/\/?[^\/]+/.exec(root_page)[0],
		append_to = document.head || document.getElementsByTagName("head"),

		// inferences... ick, but still necessary
		opera_or_gecko = (global.opera && Object.prototype.toString.call(global.opera) == "[object Opera]") || ("MozAppearance" in document.documentElement.style),

		// feature sniffs (yay!)
		test_script_elem = document.createElement("script"),
		script_ordered_async = test_script_elem.async === true, // http://wiki.whatwg.org/wiki/Dynamic_Script_Execution_Order
		explicit_script_preload = typeof test_script_elem.preload == "boolean", // http://wiki.whatwg.org/wiki/Script_Execution_Control#Proposal_1_.28Nicholas_Zakas.29
		script_preload = explicit_script_preload || (test_script_elem.readyState && test_script_elem.readyState == "uninitialized") // will a script preload with `src` set before DOM append?
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
		return target;
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
		chain_group.finished = true;
		return true;
	}
	
	// creates a script load listener
	function create_script_load_listener(elem,registry_item,flag,onload) {
		elem.onload = elem.onreadystatechange = function() {
			if ((elem.readyState && elem.readyState != "complete" && elem.readyState != "loaded") || registry_item[flag]) return;
			elem.onload = elem.onreadystatechange = null;
			onload();
		};
	}

	// script executed handler
	function script_executed(script_obj,chain_group,registry_item) {
		registry_item.ready = registry_item.finished = true;
		for (var i=0; i<registry_item.finished_listeners.length; i++) {
			setTimeout(registry_item.finished_listeners[i],0);
		}
		registry_item.ready_listeners = [];
		registry_item.finished_listeners = [];
	}

	// make the request for a script
	function request_script(chain_opts,script_obj,chain_group,registry_item,onload) {
		setTimeout(function(){
			if ("item" in append_to) { // check if ref is still a live node list
				if (!append_to[0]) { // append_to node not yet ready
					setTimeout(arguments.callee,25); // try again in a little bit -- note, will recall the anonymous function in the outer setTimeout, not the parent `request_script()`
					return;
				}
				append_to = append_to[0]; // reassign from live node list ref to pure node ref -- avoids nasty IE bug where changes to DOM invalidate live node lists
			}
			var script = document.createElement("script"), 
				src = script_obj.real_src = script_obj.src + (chain_opts[_CacheBust] ? (/\?.*$/.test(script_obj.src) ? "&_" : "?_") + ~~(Math.random()*1E9) + "=" : "")
			;
			if (script_obj.type) script.type = script_obj.type;
			if (script_obj.charset) script.charset = script_obj.charset;
			
			// no preloading, just normal script element
			if (!chain_group.preload) {
				if (script_ordered_async) script.async = false;
				create_script_load_listener(script,registry_item,"finished",onload);
				script.src = src;
				append_to.insertBefore(script,append_to.firstChild);
			}
			// real script preloading
			else if (script_preload) {
				registry_item.elem = script;
				if (explicit_script_preload) { // Zakas style preloading (aka, explicit preloading)
					script.preload = true;
					script.onpreload = onload;
				}
				else {
					script.onreadystatechange = function(){
						if (script.readyState == "loaded") onload();
						script.onreadystatechange = null;
					};
				}
				script.src = src;
				// NOTE: no append to DOM yet, appending will happen when ready to execute
			}
			// use async=false parallel-load-serial-execute
			else if (script_ordered_async) {
				script.async = false;
				create_script_load_listener(script,registry_item,"finished",onload);
				script.src = src;
				append_to.insertBefore(script,append_to.firstChild);
			}
			// same-domain, so use XHR+script injection
			else if (same_domain(src) && chain_opts[_UseLocalXHR]) {
				var xhr = XMLHttpRequest ? new XMLHttpRequest() : (ActiveXObject ? new ActiveXObject("Microsoft.XMLHTTP") : null);
				if (!xhr) {
					global_defaults[_UseLocalXHR] = chain_opts[_UseLocalXHR] = false; // can't use XHR for some reason, so don't try anymore
					return request_script(chain_opts,registry_item,onload);
				}
				xhr.onreadystatechange = function() {
					if (xhr.readyState === 4) {
						xhr.onreadystatechange = function(){}; // fix a memory leak in IE
						registry_item.text = xhr.responseText + "\n//@ sourceURL=" + src; // http://blog.getfirebug.com/2009/08/11/give-your-eval-a-name-with-sourceurl/
						onload();
					}
				};
				xhr.open("GET",src);
				xhr.send("");
			}
			// as a last resort, use cache-preloading
			else {
				script.type = "text/cache-script";
				create_script_load_listener(script,registry_item,"ready",function() {
					append_to.removeChild(script);
					onload();
				});
				script.src = src;
				append_to.insertBefore(script,append_to.firstChild);
			}
		},0);
	}
		
	// create a clean instance of $LAB
	function create_sandbox() {
		var global_defaults = {},
			use_preloading = !script_ordered_async && (script_preload || !opera_or_gecko),
			queue = [],
			registry = {},
			instanceAPI
		;

		// global defaults
		global_defaults[_UseLocalXHR] = true;
		global_defaults[_AlwaysPreserveOrder] = false;
		global_defaults[_AllowDuplicates] = false;
		global_defaults[_CacheBust] = false;
		global_defaults[_BasePath] = "";

		// execute a script that has been preloaded already
		function execute_preloaded_script(chain_opts,script_obj,chain_group,registry_item) {
			if (registry[script_obj.src].executed) return;
			if (!chain_opts[_AllowDuplicates]) registry[script_obj.src].executed = true;
			
			var script = registry_item.elem || document.createElement("script");
			if (script_obj.type) script.type = script_obj.type;
			if (script_obj.charset) script.charset = script_obj.charset;
			create_script_load_listener(script,registry_item,"finished",function(){
				script_executed(script_obj,chain_group,registry_item);
				script = null;
			});
			
			// script elem was real-preloaded
			if (registry_item.elem) {
				registry_item.elem = null;
			}
			// script was XHR preloaded
			else if (registry_item.text) {
				script.text = registry_item.text;
			}
			// script was cache-preloaded
			else {
				script.src = script_obj.real_src;
			}
			append_to.insertBefore(script,append_to.firstChild);
		}
	
		// process the script request setup
		function do_script(chain_opts,script_obj,chain_group) {
			var registry_item,
				registry_items,
				ready_cb = function(){ script_obj.ready_cb(script_obj,chain_group,function(){ execute_preloaded_script(chain_opts,script_obj,chain_group,registry_item); }); },
				finished_cb = function(){ script_obj.finished_cb(script_obj,chain_group); }
			;

			script_obj.src = canonical_uri(script_obj.src,chain_opts[_BasePath]);

			if (!registry[script_obj.src]) registry[script_obj.src] = {items:[],executed:false};
			registry_items = registry[script_obj.src].items;

			// allowing duplicates, or is this the first recorded load of this script?
			if (chain_opts[_AllowDuplicates] || registry_items.length == 0) {
				registry_item = registry_items[registry_items.length] = {
					ready:false,
					finished:false,
					ready_listeners:[ready_cb],
					finished_listeners:[finished_cb]
				};
	
				request_script(chain_opts,script_obj,chain_group,registry_item,
					(chain_group.preload) ? function(){
						registry_item.ready = true;
						for (var i=0; i<registry_item.ready_listeners.length; i++) {
							setTimeout(registry_item.ready_listeners[i],0);
						}
						registry_item.ready_listeners = [];
					} :
					function(){ script_executed(script_obj,chain_group,registry_item); }
				);
			}
			else {
				registry_item = registry_items[0];
				if (registry_item.finished) {
					setTimeout(finished_cb,0);
				}
				else {
					registry_item.finished_listeners.push(finished_cb);
				}
			}
		}

		// creates a closure for each separate chain spawned from this $LAB instance, to keep state cleanly separated between chains
		function create_chain() {
			var chainedAPI,
				chain_opts = merge_objs(global_defaults,{}),
				chain = [],
				exec_cursor = 0,
				scripts_currently_loading = false,
				group
			;
			
			// called when a script has finished preloading
			function chain_script_ready(script_obj,chain_group,exec_trigger) {
				script_obj.ready = true;
				script_obj.exec_trigger = exec_trigger;
				advance_exec_cursor(); // will only check for 'ready' scripts to be executed
			}

			// called when a script has finished executing
			function chain_script_executed(script_obj,chain_group) {
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
			
			// setup next chain script group
			function init_script_chain_group() {
				if (!group || !group.scripts) {
					chain.push(group = {scripts:[],finished:true,preload:use_preloading&&scripts_currently_loading});
				}
			}

			chainedAPI = {
				script:function(){
					init_script_chain_group();
					scripts_currently_loading = true;
					for (var i=0; i<arguments.length; i++) {
						(function(script_obj,script_list){
							if (!is_array(script_obj)) {
								script_list = [script_obj];
							}
							for (var j=0; j<script_list.length; j++) {
								init_script_chain_group();
								script_obj = script_list[j];
								
								if (is_func(script_obj)) script_obj = script_obj();
								if (!script_obj) continue;
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
									ready_cb:chain_script_ready,
									finished:false,
									finished_cb:chain_script_executed
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
					
					advance_exec_cursor();
					
					return chainedAPI;
				}
			};

			return {
				script:chainedAPI.script, 
				wait:chainedAPI.wait, 
				setOptions:function(opts){
					merge_objs(opts,chain_opts);
					return chainedAPI;
				}
			};
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
			// rollback `[global].$LAB` to what it was before this file was loaded, the return this current instance of $LAB
			noConflict:function(){
				global.$LAB = _$LAB;
				return instanceAPI;
			},
			// create another clean instance of $LAB
			sandbox:function(){
				return create_sandbox();
			}
		};

		return instanceAPI;
	}

	// create the main instance of $LAB
	global.$LAB = create_sandbox();

})(this);