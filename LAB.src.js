/*! LAB.js (LABjs :: Loading And Blocking JavaScript)
    v3.0.0-pre1 (c) Kyle Simpson
    MIT License
*/

(function UMD(name,context,definition){
	if (typeof define === "function" && define.amd) { define(definition); }
	else { context[name] = definition(name,context); }
})("$LAB",this,function DEF(name,context){
	"use strict";

	var _$LAB = context.$LAB;

	// constants for the valid keys of the options object
	var _AlwaysPreserveOrder = "AlwaysPreserveOrder";
	var _AllowDuplicates = "AllowDuplicates";
	var _CacheBust = "CacheBust";
	/*!START_DEBUG*/var _Debug = "Debug";/*!END_DEBUG*/
	var _BasePath = "BasePath";

	// stateless variables used across all $LAB instances
	var root_page = /^[^?#]*\//.exec(location.href)[0];
	var root_domain = /^\w+\:\/\/\/?[^\/]+/.exec(root_page)[0];
	var append_to = document.head;

/*!START_DEBUG*/
	// console.log() and console.error() wrappers
	var log_msg = function NOOP(){};
	var log_error = log_msg;
/*!END_DEBUG*/

	// feature sniffs (yay!)
	var test_script_elem = document.createElement("script"),
	var real_preloading;

	// http://wiki.whatwg.org/wiki/Dynamic_Script_Execution_Order
	var script_ordered_async = !real_preloading && test_script_elem.async === true;

/*!START_DEBUG*/
	// define console wrapper functions if applicable
	if (context.console && context.console.log) {
		if (!context.console.error) context.console.error = context.console.log;
		log_msg = function LOG_MSG(msg) { context.console.log(msg); };
		log_error = function LOG_ERROR(msg,err) { context.console.error(msg,err); };
	}
/*!END_DEBUG*/


	// create the main instance of $LAB
	return createSandbox();


	// **************************************

	// test for function
	function is_func(func) { return Object.prototype.toString.call(func) == "[object Function]"; }

	// test for array
	function is_array(arr) { return Object.prototype.toString.call(arr) == "[object Array]"; }

	// make script URL absolute/canonical
	function canonical_uri(src,base_path) {
		var absolute_regex = /^\w+\:\/\//;

		// is `src` is protocol-relative (begins with // or ///), prepend protocol
		if (/^\/\/\/?/.test(src)) {
			src = location.protocol + src;
		}
		// is `src` page-relative? (not an absolute URL, and not a domain-relative path, beginning with /)
		else if (!absolute_regex.test(src) && src.charAt(0) != "/") {
			// prepend `base_path`, if any
			src = (base_path || "") + src;
		}
		// make sure to return `src` as absolute
		return absolute_regex.test(src) ? src : ((src.charAt(0) == "/" ? root_domain : root_page) + src);
	}

	// merge `source` into `target`
	function merge_objs(source,target) {
		for (var k in source) { if (source.hasOwnProperty(k)) {
			target[k] = source[k]; // TODO: does this need to be recursive for our purposes?
		}}
		return target;
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
	function script_executed(registry_item) {
		registry_item.ready = registry_item.finished = true;
		for (var i=0; i<registry_item.finished_listeners.length; i++) {
			registry_item.finished_listeners[i]();
		}
		registry_item.ready_listeners = [];
		registry_item.finished_listeners = [];
	}

	// make the request for a scriptha
	function requestScript(chain_opts,script_obj,registry_item,onload,preload_this_script) {
		var script;
		var src = script_obj.real_src;

		script = document.createElement("script");

		if (script_obj.type) {
			script.type = script_obj.type;
		}
		if (script_obj.charset) {
			script.charset = script_obj.charset;
		}

		// should preloading be used for this script?
		if (preload_this_script) {
			// TODO
		}
		// use async=false for ordered async?
		// parallel-load-serial-execute
		// http://wiki.whatwg.org/wiki/Dynamic_Script_Execution_Order
		else if (script_ordered_async) {
			/*!START_DEBUG*/if (chain_opts[_Debug]) log_msg("start script load (ordered async): "+src);/*!END_DEBUG*/
			script.async = false;
			create_script_load_listener(script,registry_item,"finished",onload);
			script.src = src;
			append_to.insertBefore(script,append_to.firstChild);
		}
		// otherwise, just a normal script element
		else {
			/*!START_DEBUG*/if (chain_opts[_Debug]) log_msg("start script load: "+src);/*!END_DEBUG*/
			create_script_load_listener(script,registry_item,"finished",onload);
			script.src = src;
			append_to.insertBefore(script,append_to.firstChild);
		}
	}

	// create a clean instance of $LAB
	function createSandbox() {
		var global_defaults = {};
		var queue = [];
		var registry = {};
		var instanceAPI;

		// global defaults
		global_defaults[_AlwaysPreserveOrder] = false;
		global_defaults[_AllowDuplicates] = false;
		global_defaults[_CacheBust] = false;
		/*!START_DEBUG*/global_defaults[_Debug] = false;/*!END_DEBUG*/
		global_defaults[_BasePath] = "";


		// API for each initial $LAB instance (before chaining starts)
		instanceAPI = {
			// main API functions
			setGlobalDefaults: function setGlobalDefaults(opts){
				merge_objs(opts,global_defaults);
				return instanceAPI;
			},
			setOptions: function setOptions(){
				return createChainInstance().setOptions.apply(null,arguments);
			},
			script: function script(){
				return createChainInstance().script.apply(null,arguments);
			},
			wait: function wait(){
				return createChainInstance().wait.apply(null,arguments);
			},

			// built-in queuing for $LAB `script()` and `wait()` calls
			// useful for building up a chain programmatically across various script locations, and simulating
			// execution of the chain
			queueScript: function queueScript(){
				queue.push({
					type: "script",
					args: [].slice.call(arguments)
				});
				return instanceAPI;
			},
			queueWait: function queueWait(){
				queue.push({
					type: "wait",
					args: [].slice.call(arguments)
				});
				return instanceAPI;
			},
			runQueue: function runQueue(){
				var $L = instanceAPI;
				while (queue.length > 0) {
					val = queue.shift();
					$L = $L[val.type].apply(null,val.args);
				}
				return $L;
			},

			// rollback `context.$LAB` to what it was before this file
			// was loaded, then return this current instance of $LAB
			noConflict: function onConflict(){
				context.$LAB = _$LAB;
				return instanceAPI;
			},

			// create another clean instance of $LAB
			sandbox: function sandbox(){
				return createSandbox();
			}
		};

		return instanceAPI;


		// **************************************

		// execute a script that has been preloaded already
		function execute_preloaded_script(chain_opts,script_obj,registry_item) {
			var script;

			function preload_execute_finished() {
				if (script != null) { // make sure this only ever fires once
					script = null;
					script_executed(registry_item);
				}
			}

			if (registry[script_obj.src].finished) return;
			if (!chain_opts[_AllowDuplicates]) registry[script_obj.src].finished = true;

			script = registry_item.elem || document.createElement("script");
			if (script_obj.type) script.type = script_obj.type;
			if (script_obj.charset) script.charset = script_obj.charset;
			create_script_load_listener(script,registry_item,"finished",preload_execute_finished);

			// script elem was real-preloaded
			if (registry_item.elem) {
				registry_item.elem = null;
			}
			// script was XHR preloaded
			else if (registry_item.text) {
				script.onload = script.onreadystatechange = null;	// script injection doesn't fire these events
				script.text = registry_item.text;
			}
			// script was cache-preloaded
			else {
				script.src = script_obj.real_src;
			}
			append_to.insertBefore(script,append_to.firstChild);

			// manually fire execution callback for injected scripts, since events don't fire
			if (registry_item.text) {
				preload_execute_finished();
			}
		}

		// process the script request setup
		function do_script(chain_opts,script_obj,chain_group,preload_this_script) {
			var registry_item,
				registry_items,
				ready_cb = function(){ script_obj.ready_cb(script_obj,function(){ execute_preloaded_script(chain_opts,script_obj,registry_item); }); },
				finished_cb = function(){ script_obj.finished_cb(script_obj,chain_group); }
			;

			script_obj.src = canonical_uri(script_obj.src,chain_opts[_BasePath]);
			script_obj.real_src = script_obj.src +
				// append cache-bust param to URL?
				(chain_opts[_CacheBust] ? ((/\?.*$/.test(script_obj.src) ? "&_" : "?_") + ~~(Math.random()*1E9) + "=") : "")
			;

			if (!registry[script_obj.src]) registry[script_obj.src] = {items:[],finished:false};
			registry_items = registry[script_obj.src].items;

			// allowing duplicates, or is this the first recorded load of this script?
			if (chain_opts[_AllowDuplicates] || registry_items.length == 0) {
				registry_item = registry_items[registry_items.length] = {
					ready:false,
					finished:false,
					ready_listeners:[ready_cb],
					finished_listeners:[finished_cb]
				};

				requestScript(chain_opts,script_obj,registry_item,
					// which callback type to pass?
					(
					 	(preload_this_script) ? // depends on script-preloading
						function(){
							registry_item.ready = true;
							for (var i=0; i<registry_item.ready_listeners.length; i++) {
								registry_item.ready_listeners[i]();
							}
							registry_item.ready_listeners = [];
						} :
						function(){ script_executed(registry_item); }
					),
					// signal if script-preloading should be used or not
					preload_this_script
				);
			}
			else {
				registry_item = registry_items[0];
				if (registry_item.finished) {
					finished_cb();
				}
				else {
					registry_item.finished_listeners.push(finished_cb);
				}
			}
		}

		// creates a closure for each separate chain spawned from this $LAB instance, to keep state cleanly separated between chains
		function createChainInstance() {
			var chainedAPI,
				chain_opts = merge_objs(global_defaults,{}),
				chain = [],
				exec_cursor = 0,
				scripts_currently_loading = false,
				group
			;

			// API for $LAB chains
			chainedAPI = {
				script: script,
				wait: wait,
			};

			// the first chain link API (includes `setOptions` only this first time)
			return {
				script: chainedAPI.script,
				wait: chainedAPI.wait,
				setOptions: function setOptions(opts){
					merge_objs(opts,chain_opts);
					return chainedAPI;
				}
			};


			// **************************************

			// called when a script has finished preloading
			function chain_script_ready(script_obj,exec_trigger) {
				/*!START_DEBUG*/if (chain_opts[_Debug]) log_msg("script preload finished: "+script_obj.real_src);/*!END_DEBUG*/
				script_obj.ready = true;
				script_obj.exec_trigger = exec_trigger;
				advance_exec_cursor(); // will only check for 'ready' scripts to be executed
			}

			// called when a script has finished executing
			function chain_script_executed(script_obj,chain_group) {
				/*!START_DEBUG*/if (chain_opts[_Debug]) log_msg("script execution finished: "+script_obj.real_src);/*!END_DEBUG*/
				script_obj.ready = script_obj.finished = true;
				script_obj.exec_trigger = null;
				// check if chain group is all finished
				for (var i=0; i<chain_group.scripts.length; i++) {
					if (!chain_group.scripts[i].finished) return;
				}
				// chain_group is all finished if we get this far
				chain_group.finished = true;
				advance_exec_cursor();
			}

			// main driver for executing each part of the chain
			function advance_exec_cursor() {
				while (exec_cursor < chain.length) {
					if (is_func(chain[exec_cursor])) {
						/*!START_DEBUG*/if (chain_opts[_Debug]) log_msg("$LAB.wait() executing: "+chain[exec_cursor]);/*!END_DEBUG*/
						try { chain[exec_cursor++](); } catch (err) {
							/*!START_DEBUG*/if (chain_opts[_Debug]) log_error("$LAB.wait() error caught: ",err);/*!END_DEBUG*/
						}
						continue;
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
					chain.push(group = {scripts:[],finished:true});
				}
			}

			// start loading one or more scripts
			function script(){
				for (var i=0; i<arguments.length; i++) {
					(function(script_obj,script_list){
						var splice_args;

						if (!is_array(script_obj)) {
							script_list = [script_obj];
						}
						for (var j=0; j<script_list.length; j++) {
							init_script_chain_group();
							script_obj = script_list[j];

							if (is_func(script_obj)) script_obj = script_obj();
							if (!script_obj) continue;
							if (is_array(script_obj)) {
								// set up an array of arguments to pass to splice()
								splice_args = [].slice.call(script_obj); // first include the actual array elements we want to splice in
								splice_args.unshift(j,1); // next, put the `index` and `howMany` parameters onto the beginning of the splice-arguments array
								[].splice.apply(script_list,splice_args); // use the splice-arguments array as arguments for splice()
								j--; // adjust `j` to account for the loop's subsequent `j++`, so that the next loop iteration uses the same `j` index value
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

							do_script(chain_opts,script_obj,group,(can_use_preloading && scripts_currently_loading));
							scripts_currently_loading = true;

							if (chain_opts[_AlwaysPreserveOrder]) chainedAPI.wait();
						}
					})(arguments[i],arguments[i]);
				}
				return chainedAPI;
			}

			// force LABjs to pause in execution at this point in the chain, until the execution thus far finishes, before proceeding
			function wait(){
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
		}
	}

});
