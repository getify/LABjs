// LAB.js (LABjs :: Loading And Blocking JavaScript)
// v1.0rc2a (c) Kyle Simpson
// MIT License

(function(global){
	var sUNDEF = "undefined",				// constants used for compression optimization
		sSTRING = "string",
		sOBJECT = "object",
		sHEAD = "head",
		sBODY = "body",
		sFUNCTION = "function",
		sSCRIPT = "script",
		sREADYSTATE = "readyState",
		sXHRPOLL = "xhrpoll",
		sPRELOADDONE = "preloaddone",
		sLOADTRIGGER = "loadtrigger",
		sSRCURI = "srcuri",
		sPRELOAD = "preload",
		sDONE = "done",
		sWHICH = "which",
		bTRUE = true,
		bFALSE = false,
		oDOC = global.document,
		oDOCLOC = oDOC.location,
		oACTIVEX = global.ActiveXObject,
		fSETTIMEOUT = global.setTimeout,
		fSETINTERVAL = global.setInterval,
		fCLEARINTERVAL = global.clearInterval,
		fGETELEMENTSBYTAGNAME = function(tn){return oDOC.getElementsByTagName(tn);},
		fOBJTOSTRING = Object.prototype.toString,
		fNOOP = function(){},
		append_to = {},
		all_scripts = {},
		PAGEROOT = /^[^?#]*\//.exec(oDOCLOC.href)[0], // these ROOTs do not support file:/// usage, only http:// type usage
		DOCROOT = /^\w+\:\/\/[^\/]+/.exec(PAGEROOT)[0],
		docScripts = fGETELEMENTSBYTAGNAME(sSCRIPT),
		is_ie = !+"\v1", // feature detection based on Andrea Giammarchi's solution: http://webreflection.blogspot.com/2009/01/32-bytes-to-know-if-your-browser-is-ie.html
		is_safari = /a/.__proto__=='//', // feature detections from http://www.thespanner.co.uk/2009/01/29/detecting-browsers-javascript-hacks/
		is_chrome = /source/.test((/a/.toString+'')),
		is_opera = /^function \(/.test([].sort),
		is_ff = /a/[-1]=='a',
		global_defs = {
			preload:bTRUE, // use various tricks for "preloading" scripts
			cache:is_ie||is_safari||is_chrome, // IE/Safari/Chrome can use the "cache" trick to preload
			order:is_ff||is_opera, // FF/Opera preserve execution order with script tags automatically, so just add all scripts as fast as possible
			xhr:bTRUE, // use XHR trick to preload local scripts
			dupe:bFALSE, // allow duplicate scripts?
			preserve:bFALSE, // preserve execution order of all loaded scripts (regardless of preloading)
			base:"", // base path to prepend to all non-absolute-path scripts
			which:sHEAD // which DOM object ("head" or "body") to append scripts to
		}
	;
	
	append_to[sHEAD] = fGETELEMENTSBYTAGNAME(sHEAD);
	append_to[sBODY] = fGETELEMENTSBYTAGNAME(sBODY);
	
	function canonicalScriptURI(src,base_path) {
		if (typeof src !== sSTRING) src = "";
		if (typeof base_path !== sSTRING) base_path = "";
		var ret = (/^\w+\:\/\//.test(src) ? "" : base_path) + src;
		return ((/^\w+\:\/\//.test(ret) ? "" : (ret.charAt(0) === "/" ? DOCROOT : PAGEROOT)) + ret);
	}
	function sameDomain(src) { return (canonicalScriptURI(src).indexOf(DOCROOT) === 0); }
	function scriptTagExists(uri) { // checks if a script uri has ever been loaded into this page's DOM
		var i = 0, script;
		while (script = docScripts[i++]) {
			if (typeof script.src === sSTRING && uri === canonicalScriptURI(script.src) && script.getAttribute("rel") !== sPRELOAD) return bTRUE;
		}
		return bFALSE;
	}
	function engine(queueExec,opts) {
		queueExec = !(!queueExec);
		if (typeof opts === sUNDEF) opts = global_defs;
		
		var ready = bFALSE,
			_use_preload = queueExec && opts.preload,
			_use_cache_preload = _use_preload && opts.cache,
			_use_script_order = _use_preload && opts.order,
			_use_xhr_preload = _use_preload && opts.xhr,
			_auto_wait = opts.preserve,
			_which = opts.which,
			_base_path = opts.base,
			waitFunc = fNOOP,
			scripts_loading = bFALSE,
			publicAPI,
			first_pass = bTRUE,
			scripts = {},
			exec = []
		;
		
		_use_preload = _use_cache_preload || _use_xhr_preload || _use_script_order; // if all flags are turned off, preload is moot so disable it
		
		function isScriptLoaded(elem,scriptentry) {
			if ((elem[sREADYSTATE] && elem[sREADYSTATE]!=="complete" && elem[sREADYSTATE]!=="loaded") || scriptentry[sDONE]) { return bFALSE; }
			elem.onload = elem.onreadystatechange = null; // prevent memory leak
			return bTRUE;
		}
		function handleScriptLoad(elem,scriptentry,skipReadyCheck) {
			skipReadyCheck = !(!skipReadyCheck); // used to override ready check when script text was injected from XHR preload
			if (!skipReadyCheck && !(isScriptLoaded(elem,scriptentry))) return;
			scriptentry[sDONE] = bTRUE;

			for (var key in scripts) {
				if (scripts.hasOwnProperty(key) && !(scripts[key][sDONE])) return;
			}
			ready = bTRUE;
			if (ready) waitFunc();
		}
		function loadTriggerExecute(scriptentry) {
			if (typeof scriptentry[sLOADTRIGGER] === sFUNCTION) {
				scriptentry[sLOADTRIGGER]();
				scriptentry[sLOADTRIGGER] = null; // prevent memory leak
			}
		}
		function handleScriptPreload(elem,scriptentry) {
			if (!isScriptLoaded(elem,scriptentry)) return;
			scriptentry[sPRELOADDONE] = bTRUE;
			fSETTIMEOUT(function(){
				append_to[scriptentry[sWHICH]][0].removeChild(elem); // remove preload script node
				loadTriggerExecute(scriptentry);
			},0);
		}
		function handleXHRPreload(xhr,scriptentry) {
			if (xhr[sREADYSTATE] === 0) fCLEARINTERVAL(scriptentry[sXHRPOLL]); // necessary? verify against jquery source
			if (xhr[sREADYSTATE] === 4) {
				fCLEARINTERVAL(scriptentry[sXHRPOLL]);
				scriptentry[sPRELOADDONE] = bTRUE;
				fSETTIMEOUT(function(){ loadTriggerExecute(scriptentry); },0);
			}
		}
		function createScriptTag(scriptentry,src,type,charset,rel,onload,scriptText) {
			fSETTIMEOUT(function(){
				if (append_to[scriptentry[sWHICH]][0] === null) { // append_to object not yet ready
					fSETTIMEOUT(arguments.callee,25); 
					return;
				}
				var scriptElem = oDOC.createElement(sSCRIPT), fSETATTRIBUTE = function(attr,val){scriptElem.setAttribute(attr,val);};
				fSETATTRIBUTE("type",type);
				fSETATTRIBUTE("rel",rel);
				if (typeof charset === sSTRING) fSETATTRIBUTE("charset",charset);
				if (typeof onload === sFUNCTION) { // load script via 'src' attribute, set onload/onreadystatechange listeners
					scriptElem.onload = scriptElem.onreadystatechange = function(){onload(scriptElem,scriptentry);};
					fSETATTRIBUTE("src",src);
				}
				append_to[scriptentry[sWHICH]][0].appendChild(scriptElem);
				if (typeof scriptText === sSTRING) { // script text already avaiable from XHR preload, so just inject it
					scriptElem.text = scriptText;
					handleScriptLoad(scriptElem,scriptentry,bTRUE); // manually call 'load' callback function, skipReadyCheck=true
				}
			},0);
		}
		function loadScriptElem(scriptentry,src,type,charset) {
			all_scripts[scriptentry[sSRCURI]] = bTRUE;
			createScriptTag(scriptentry,src,type,charset,"",handleScriptLoad);
		}
		function loadScriptCache(scriptentry,src,type,charset) {
			var args = arguments;
			if (first_pass && typeof scriptentry[sPRELOADDONE] === sUNDEF) { // need to preload into cache
				scriptentry[sPRELOADDONE] = bFALSE;
				createScriptTag(scriptentry,src,"text/html",charset,sPRELOAD,handleScriptPreload); // "text/html" causes a fetch into cache, but no execution
			}
			else if (!first_pass && !scriptentry[sPRELOADDONE]) { // preload still in progress, make sure trigger is set for execution later
				scriptentry[sLOADTRIGGER] = function(){loadScriptCache.apply(null,args);};
			}
			else if (!first_pass) { // preload done, so reload (from cache, hopefully!) as regular script element
				loadScriptElem.apply(null,args);
			}
		}
		function loadScriptXHR(scriptentry,src,type,charset) {
			var args = arguments, xhr;
			if (first_pass && typeof scriptentry[sPRELOADDONE] === sUNDEF) { // need to preload
				scriptentry[sPRELOADDONE] = bFALSE;
				xhr = scriptentry.xhr = (oACTIVEX ? new oACTIVEX("Microsoft.XMLHTTP") : new global.XMLHttpRequest());
				scriptentry[sXHRPOLL] = fSETINTERVAL(function() { handleXHRPreload(xhr,scriptentry); },13);
				xhr.open("GET",src);
				xhr.send("");
			}
			else if (!first_pass && !scriptentry[sPRELOADDONE]) {	// preload XHR still in progress, make sure trigger is set for execution later
				scriptentry[sLOADTRIGGER] = function(){loadScriptXHR.apply(null,args);};
			}
			else if (!first_pass) { // preload done, so "execute" script via injection
				all_scripts[scriptentry[sSRCURI]] = bTRUE;
				createScriptTag(scriptentry,src,type,charset,"",null,scriptentry.xhr.responseText);
				scriptentry.xhr = null;
			}
		}
		function loadScript(o) {
			if (typeof o.allowDup === sUNDEF) o.allowDup = opts.dupe;
			var src = o.src, type = o.type, charset = o.charset, allowDup = o.allowDup, 
				src_uri = canonicalScriptURI(src,_base_path), scriptentry, same_domain = sameDomain(src_uri);
			if (typeof type !== sSTRING) type = "text/javascript";
			if (typeof charset !== sSTRING) charset = null;
			allowDup = !(!allowDup);
						
			if (!allowDup && 
				(
					(typeof all_scripts[src_uri] !== sUNDEF && all_scripts[src_uri] !== null) || 
					(first_pass && scripts[src_uri]) ||
					scriptTagExists(src_uri)
				)
			) {
				if (typeof scripts[src_uri] !== sUNDEF && scripts[src_uri][sPRELOADDONE] && !scripts[src_uri][sDONE] && same_domain) {
					// this script was preloaded via XHR, but is a duplicate, and dupes are not allowed
					handleScriptLoad(null,scripts[src_uri],bTRUE); // mark the entry as done and check if chain group is done
				}
				return;
			}
			if (typeof scripts[src_uri] === sUNDEF) scripts[src_uri] = {};
			scriptentry = scripts[src_uri];
			if (typeof scriptentry[sWHICH] === sUNDEF) scriptentry[sWHICH] = _which;
			scriptentry[sDONE] = bFALSE;
			scriptentry[sSRCURI] = src_uri;
			scripts_loading = bTRUE;
			
			if (!_use_script_order && _use_xhr_preload && same_domain) loadScriptXHR(scriptentry,src_uri,type,charset);
			else if (!_use_script_order && _use_cache_preload) loadScriptCache(scriptentry,src_uri,type,charset);
			else loadScriptElem(scriptentry,src_uri,type,charset);
		}
		function onlyQueue(execBody) {
			exec.push(execBody);
		}
		function queueAndExecute(execBody) { // helper for publicAPI functions below
			if (queueExec && !_use_script_order) onlyQueue(execBody);
			if (!queueExec || _use_preload) execBody(); // if engine is either not queueing, or is queuing in preload mode, go ahead and execute
		}
		function serializeArgs(args) {
			var sargs = [];
			for (var i=0; i<args.length; i++) {
				if (fOBJTOSTRING.call(args[i]) === "[object Array]") sargs = sargs.concat(serializeArgs(args[i]));
				else sargs[sargs.length] = args[i];
			}
			return sargs;
		}
				
		publicAPI = {
			script:function() {
				var args = serializeArgs(arguments), use_engine = publicAPI;
				if (_auto_wait) {
					for (var i=0; i<args.length; i++) {
						if (i===0) {
							queueAndExecute(function(){
								var arg = (typeof args[0] === sOBJECT) ? args[0] : {src:args[0]};
								loadScript(arg);
							});
						}
						else use_engine = use_engine.script(args[i]);
						use_engine = use_engine.wait();
					}
				}
				else {
					queueAndExecute(function(){
						for (var i=0; i<args.length; i++) {
							var arg = (typeof args[i] === sOBJECT) ? args[i] : {src:args[i]};
							loadScript(arg);
						}
					});
				}
				return use_engine;
			},
			wait:function(func) {
				first_pass = false;
				if (typeof func !== sFUNCTION) func = fNOOP;
				// On this current chain's waitFunc function, tack on call to trigger the queue for the *next* engine 
				// in the chain, which will be executed when the current chain finishes loading
				var e = engine(bTRUE,opts),	// 'bTRUE' tells the engine to be in queueing mode
					triggerNextChain = e.trigger, // store ref to e's trigger function for use by 'wfunc'
					wfunc = function(){ try { func(); } catch(err) {} triggerNextChain(); };
				delete e.trigger; // remove the 'trigger' property from e's public API, since only used internally
				var fn = function(){
					if (scripts_loading && !ready) waitFunc = wfunc;
					else fSETTIMEOUT(wfunc,0);
				};
				
				if (queueExec && !scripts_loading) onlyQueue(fn)
				else queueAndExecute(fn);
				return e;
			}
		};
		publicAPI.block = publicAPI.wait;	// alias "block" to "wait" -- "block" is now deprecated
		if (queueExec) {
			// if queueing, return a function that the previous chain's waitFunc function can use to trigger this 
			// engine's queue. NOTE: this trigger function is captured and removed from the public chain API before return
			publicAPI.trigger = function() {
				var i=0, fn; 
				while (fn = exec[i++]) fn();
				exec = []; 
			}
		}
		return publicAPI;
	}
	function extendOpts(opts) {
		var k, newOpts = {}, optMappings = {"UseCachePreload":"cache","UseLocalXHR":"xhr","UsePreloading":"preload","AlwaysPreserveOrder":"preserve","AppendTo":"which","AllowDuplicates":"dupe","BasePath":"base"};
		newOpts.order = !(!global_defs.order);
		for (k in optMappings) {
			if (typeof global_defs[optMappings[k]] !== sUNDEF) newOpts[optMappings[k]] = (typeof opts[k] !== sUNDEF) ? opts[k] : global_defs[optMappings[k]];
		}
		newOpts.preserve = !(!newOpts.preserve);
		newOpts.cache = !(!newOpts.cache);
		newOpts.xhr = !(!newOpts.xhr);
		newOpts.preload = !(!newOpts.preload);
		newOpts.dupe = !(!newOpts.dupe);
		newOpts.base = (typeof newOpts.base === sSTRING) ? newOpts.base : "";
		if (!newOpts.preload) newOpts.cache = newOpts.order = newOpts.xhr = bFALSE;
		newOpts.which = (newOpts.which === sHEAD || newOpts.which === sBODY) ? newOpts.which : sHEAD;
		return newOpts;
	}
	
	global.$LAB = {
		setGlobalDefaults:function(gdefs) { // intentionally does not return an "engine" instance -- must call as stand-alone function call on $LAB
			global_defs = extendOpts(gdefs);
		},
		setOptions:function(opts){ // set options per chain
			return engine(bFALSE,extendOpts(opts));
		},
		script:function(){ // will load one or more scripts
			return engine().script.apply(null,arguments);
		},
		wait:function(){ // will ensure that the chain's previous scripts are executed before execution of scripts in subsequent chain links
			return engine().wait.apply(null,arguments);
		}
	};
	global.$LAB.block = global.$LAB.wait;	// alias "block" to "wait" -- "block" is now deprecated
})(window);