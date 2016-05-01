/*! LAB.js (LABjs :: Loading And Blocking JavaScript)
    v3.0.0-pre1 (c) Kyle Simpson
    MIT License
*/

(function UMD(name,context,definition){
	if (typeof define === "function" && define.amd) { define(definition); }
	else { context[name] = definition(name,context); }
})("$LAB",this,function DEF(name,context){
	"use strict";

	var old$LAB = context.$LAB;

	// constants for the valid keys of the options object
	var keyAlwaysPreserveOrder = "AlwaysPreserveOrder";
	var keyAllowDuplicates = "AllowDuplicates";
	var keyCacheBust = "CacheBust";
	/*!START_DEBUG*/var debugMode = "Debug";/*!END_DEBUG*/
	var keyBasePath = "BasePath";

	// stateless variables used across all $LAB instances
	var rootPage = /^[^?#]*\//.exec(location.href)[0];
	var rootDomain = /^\w+\:\/\/\/?[^\/]+/.exec(rootPage)[0];
	var appendTo = document.head;

/*!START_DEBUG*/
	// console.log() and console.error() wrappers
	var logMsg = function NOOP(){};
	var logError = logMsg;
/*!END_DEBUG*/

	// feature sniffs (yay!)
	var testScriptElem = document.createElement("script"),
	var realPreloading;

	// http://wiki.whatwg.org/wiki/Dynamic_Script_Execution_Order
	var scriptOrderedAsync = !realPreloading && testScriptElem.async === true;

/*!START_DEBUG*/
	// define console wrapper functions if applicable
	if (context.console && context.console.log) {
		if (!context.console.error) context.console.error = context.console.log;
		logMsg = function logMsg(msg) { context.console.log(msg); };
		logError = function logError(msg,err) { context.console.error(msg,err); };
	}
/*!END_DEBUG*/


	// create the main instance of $LAB
	return createSandbox();


	// **************************************

	// make script URL absolute/canonical
	function canonicalURI(src,basePath) {
		var absoluteRegex = /^\w+\:\/\//;

		// is `src` is protocol-relative (begins with // or ///), prepend protocol
		if (/^\/\/\/?/.test(src)) {
			src = location.protocol + src;
		}
		// is `src` page-relative? (not an absolute URL, and not a domain-relative path, beginning with /)
		else if (!absoluteRegex.test(src) && src.charAt(0) != "/") {
			// prepend `basePath`, if any
			src = (basePath || "") + src;
		}

		// make sure to return `src` as absolute
		return absoluteRegex.test(src) ?
			src :
			(
				(src.charAt(0) == "/" ? rootDomain : rootPage) + src
			);
	}

	// merge `source` into `target`
	function mergeObjs(source,target) {
		for (var k in source) {
			target[k] = source[k]; // TODO: does this need to be recursive for our purposes?
		}
		return target;
	}


	// creates a script load listener
	function createScriptLoadListener(elem,registryItem,flag,onload) {
		elem.onload = elem.onreadystatechange = function elemOnload() {
			if ((elem.readyState && elem.readyState != "complete" && elem.readyState != "loaded") || registryItem[flag]) return;
			elem.onload = elem.onreadystatechange = null;
			onload();
		};
	}

	// script executed handler
	function scriptExecuted(registryItem) {
		registryItem.ready = registryItem.finished = true;
		for (var i=0; i<registryItem.finishedListeners.length; i++) {
			registryItem.finishedListeners[i]();
		}
		registryItem.readyListeners = [];
		registryItem.finishedListeners = [];
	}

	// make the request for a scriptha
	function requestScript(chainOpts,scriptObj,registryItem,onload,preloadThisScript) {
		var script;
		var src = scriptObj.realSrc;

		script = document.createElement("script");

		if (scriptObj.type) {
			script.type = scriptObj.type;
		}
		if (scriptObj.charset) {
			script.charset = scriptObj.charset;
		}

		// should preloading be used for this script?
		if (preloadThisScript) {
			// TODO
		}
		// use async=false for ordered async?
		// parallel-load-serial-execute
		// http://wiki.whatwg.org/wiki/Dynamic_Script_Execution_Order
		else if (scriptOrderedAsync) {
			/*!START_DEBUG*/if (chainOpts[debugMode]) logMsg("start script load (ordered async): "+src);/*!END_DEBUG*/
			script.async = false;
			createScriptLoadListener(script,registryItem,"finished",onload);
			script.src = src;
			appendTo.insertBefore(script,appendTo.firstChild);
		}
		// otherwise, just a normal script element
		else {
			/*!START_DEBUG*/if (chainOpts[debugMode]) logMsg("start script load: "+src);/*!END_DEBUG*/
			createScriptLoadListener(script,registryItem,"finished",onload);
			script.src = src;
			appendTo.insertBefore(script,appendTo.firstChild);
		}
	}

	// create a clean instance of $LAB
	function createSandbox() {
		var globalDefaults = {};
		var queue = [];
		var registry = {};
		var instanceAPI;

		// global defaults
		globalDefaults[keyAlwaysPreserveOrder] = false;
		globalDefaults[keyAllowDuplicates] = false;
		globalDefaults[keyCacheBust] = false;
		/*!START_DEBUG*/globalDefaults[debugMode] = false;/*!END_DEBUG*/
		globalDefaults[keyBasePath] = "";


		// API for each initial $LAB instance (before chaining starts)
		instanceAPI = {
			// main API functions
			setGlobalDefaults: function setGlobalDefaults(opts){
				mergeObjs(opts,globalDefaults);
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
				context.$LAB = old$LAB;
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
		function executePreloadedScript(chainOpts,scriptObj,registryItem) {
			var script;

			if (registry[scriptObj.src].finished) return;
			if (!chainOpts[keyAllowDuplicates]) registry[scriptObj.src].finished = true;

			script = registryItem.elem || document.createElement("script");
			if (scriptObj.type) script.type = scriptObj.type;
			if (scriptObj.charset) script.charset = scriptObj.charset;
			createScriptLoadListener(script,registryItem,"finished",preloadExecuteFinished);

			script.src = scriptObj.realSrc;

			appendTo.insertBefore(script,appendTo.firstChild);

			// **************************************

			function preloadExecuteFinished() {
				if (script != null) { // make sure this only ever fires once
					script = null;
					scriptExecuted(registryItem);
				}
			}
		}

		// process the script request setup
		function setupScript(chainOpts,scriptObj,chainGroup,preloadThisScript) {
			var registryItem;
			var registryItems;

			scriptObj.src = canonicalURI(scriptObj.src,chainOpts[keyBasePath]);
			scriptObj.realSrc = scriptObj.src +
				// append cache-bust param to URL?
				(chainOpts[keyCacheBust] ? ((/\?.*$/.test(scriptObj.src) ? "&_" : "?_") + ~~(Math.random()*1E9) + "=") : "")
			;

			if (!registry[scriptObj.src]) {
				registry[scriptObj.src] = {
					items: [],
					finished: false
				};
			}
			registryItems = registry[scriptObj.src].items;

			// allowing duplicates, or is this the first recorded load of this script?
			if (chainOpts[keyAllowDuplicates] || registryItems.length == 0) {
				registryItem = registryItems[registryItems.length] = {
					ready: false,
					finished: false,
					readyListeners: [onReady],
					finishedListeners: [onFinished]
				};

				requestScript(chainOpts,scriptObj,registryItem,
					// which callback type to pass?
					(
					 	(preloadThisScript) ? // depends on script-preloading
						function onScriptPreloaded(){
							registryItem.ready = true;
							for (var i=0; i<registryItem.readyListeners.length; i++) {
								registryItem.readyListeners[i]();
							}
							registryItem.readyListeners = [];
						} :
						function onScriptExecuted(){ scriptExecuted(registryItem); }
					),
					// signal if script-preloading should be used or not
					preloadThisScript
				);
			}
			else {
				registryItem = registryItems[0];
				if (registryItem.finished) {
					onFinished();
				}
				else {
					registryItem.finishedListeners.push(onFinished);
				}
			}


			function onReady() {
				scriptObj.onReady(scriptObj,function done(){
					executePreloadedScript(chainOpts,scriptObj,registryItem);
				});
			}

			function onFinished() {
				scriptObj.onFinished(scriptObj,chainGroup);
			}
		}

		// creates a closure for each separate chain spawned from this $LAB instance, to keep state cleanly separated between chains
		function createChainInstance() {
			var chainedAPI,
				chainOpts = mergeObjs(globalDefaults,{}),
				chain = [],
				execCursor = 0,
				scriptsCurrentlyLoading = false,
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
					mergeObjs(opts,chainOpts);
					return chainedAPI;
				}
			};


			// **************************************

			// called when a script has finished preloading
			function onChainScriptReady(scriptObj,execTrigger) {
				/*!START_DEBUG*/if (chainOpts[debugMode]) logMsg("script preload finished: "+scriptObj.realSrc);/*!END_DEBUG*/
				scriptObj.ready = true;
				scriptObj.execTrigger = execTrigger;
				advanceExecutionCursor(); // will only check for 'ready' scripts to be executed
			}

			// called when a script has finished executing
			function onChainScriptExecuted(scriptObj,chainGroup) {
				/*!START_DEBUG*/if (chainOpts[debugMode]) logMsg("script execution finished: "+scriptObj.realSrc);/*!END_DEBUG*/
				scriptObj.ready = scriptObj.finished = true;
				scriptObj.execTrigger = null;
				// check if chain group is all finished
				for (var i=0; i<chainGroup.scripts.length; i++) {
					if (!chainGroup.scripts[i].finished) return;
				}
				// chainGroup is all finished if we get this far
				chainGroup.finished = true;
				advanceExecutionCursor();
			}

			// main driver for executing each part of the chain
			function advanceExecutionCursor() {
				while (execCursor < chain.length) {
					if (typeof chain[execCursor] == "function") {
						/*!START_DEBUG*/if (chainOpts[debugMode]) logMsg("$LAB.wait() executing: "+chain[execCursor]);/*!END_DEBUG*/
						try { chain[execCursor++](); } catch (err) {
							/*!START_DEBUG*/if (chainOpts[debugMode]) logError("$LAB.wait() error caught: ",err);/*!END_DEBUG*/
						}
						continue;
					}
					else if (!chain[execCursor].finished) {
						if (checkChainGroupScriptsReady(chain[execCursor])) continue;
						break;
					}
					execCursor++;
				}
				// we've reached the end of the chain (so far)
				if (execCursor == chain.length) {
					scriptsCurrentlyLoading = false;
					group = false;
				}
			}

			// setup next chain script group
			function initScriptChainGroup() {
				if (!group || !group.scripts) {
					chain.push(group = {scripts:[],finished:true});
				}
			}

			// start loading one or more scripts
			function script(){
				for (var i=0; i<arguments.length; i++) {
					(function loopScope(scriptObj,scriptList){
						var spliceArgs;

						if (!Array.isArray(scriptObj)) {
							scriptList = [scriptObj];
						}
						for (var j=0; j<scriptList.length; j++) {
							initScriptChainGroup();
							scriptObj = scriptList[j];

							if (typeof scriptObj == "function") scriptObj = scriptObj();
							if (!scriptObj) continue;
							if (Array.isArray(scriptObj)) {
								// set up an array of arguments to pass to splice()
								spliceArgs = [].slice.call(scriptObj); // first include the actual array elements we want to splice in
								spliceArgs.unshift(j,1); // next, put the `index` and `howMany` parameters onto the beginning of the splice-arguments array
								[].splice.apply(scriptList,spliceArgs); // use the splice-arguments array as arguments for splice()
								j--; // adjust `j` to account for the loop's subsequent `j++`, so that the next loop iteration uses the same `j` index value
								continue;
							}
							if (typeof scriptObj == "string") scriptObj = {src:scriptObj};
							scriptObj = mergeObjs(scriptObj,{
								ready:false,
								onReady:onChainScriptReady,
								finished:false,
								onFinished:onChainScriptExecuted
							});
							group.finished = false;
							group.scripts.push(scriptObj);

							setupScript(chainOpts,scriptObj,group,(canUsePreloading && scriptsCurrentlyLoading));
							scriptsCurrentlyLoading = true;

							if (chainOpts[keyAlwaysPreserveOrder]) chainedAPI.wait();
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

				advanceExecutionCursor();

				return chainedAPI;
			}
		}
	}

});
