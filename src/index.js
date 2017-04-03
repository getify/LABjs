(function UMD(name,context,definition){
	if (typeof define === "function" && define.amd) { define(definition); }
	else { context[name] = definition(name,context); }
})("$LAB",this,function DEF(name,context){
	"use strict";

	var old$LAB = context.$LAB;

	// placeholders for console output
	var logMsg = function NOOP(){};
	var logError = logMsg;
	// define console wrapper functions if applicable
	if (context.console && context.console.log) {
		if (!context.console.error) context.console.error = context.console.log;
		logMsg = function logMsg(msg) { context.console.log(msg); };
		logError = function logError(msg,err) { context.console.error(msg,err); };
	}
	var linkElems = document.getElementsByTagName( "link" );

	// options keys
	var optAlwaysPreserveOrder = "AlwaysPreserveOrder";
	var optCacheBust = "CacheBust";
	var optDebug = "Debug";
	var optBasePath = "BasePath";

	// stateless variables used across all $LAB instances
	var rootPageDir = /^[^?#]*\//.exec( location.href )[0];
	var rootURL = /^[\w\-]+\:\/\/\/?[^\/]+/.exec( rootPageDir )[0];
	var appendTo = document.head;

	// feature detections (yay!)
	var realPreloading = (function featureTest(){
		// Adapted from: https://gist.github.com/igrigorik/a02f2359f3bc50ca7a9c
		var tokenList = document.createElement( "link" ).relList;
		try {
			if (tokenList && tokenList.supports) {
				return tokenList.supports( "preload" );
			}
		}
		catch (err) {}
		return false;
	})();
	var scriptOrderedAsync = document.createElement( "script" ).async === true;
	var perfTiming = context.performance && context.performance.getEntriesByName;

	// create the main instance of $LAB
	return createSandbox();


	// **************************************

	function preloadResource(registryEntry) {
		var elem = document.createElement( "link" );
		elem.setAttribute( "href", registryEntry.src );
		if (registryEntry.type == "script" || registryEntry.type == "module") {
			elem.setAttribute( "as", "script" );
		}
		// TODO: handle more resource types
		elem.setAttribute( "rel", "preload" );
		elem.setAttribute( "data-requested-with", "LABjs" );
		document.head.appendChild( elem );
		registryEntry.preloadRequested = true;
		return elem;
	}

	function loadResource(registryEntry) {
		if (registryEntry.type == "script" || registryEntry.type == "module") {
			var elem = document.createElement( "script" );
			elem.setAttribute( "src", registryEntry.src );
			elem.setAttribute( "data-requested-with", "LABjs" );
			elem.async = false;		// ensure ordered execution
			if (registryEntry.type == "module") {
				elem.setAttribute( "type", "module" );
			}
		}
		if (registryEntry.opts) {
			// TODO
		}
		document.head.appendChild( elem );
		registryEntry.loadRequested = true;
		return elem;
	}

	function throwGlobalError(err) {
		setTimeout( function globalError(){ throw err; }, 0 );
	}

	function assign(target,source) {
		for (var k in source) { target[k] = source[k]; }
		return target;
	}

	// make resource URL absolute (canonical)
	function canonicalURL(src,basePath) {
		var absoluteRegex = /^[\w\-]+:\/\/\/?/;

		// `src` protocol-relative (begins with `//` or `///`)?
		if (/^\/\/\/?/.test( src )) {
			src = location.protocol + src;
		}
		// `src` page-relative (neither absolute nor domain-relative beginning with `/`)?
		else if (!absoluteRegex.test( src ) && src[0] != "/") {
			src = (basePath || "") + src;
		}

		// `src` still not absolute?
		if (!absoluteRegex.test( src )) {
			// domain-relative (begins with `/`)?
			if (src[0] == "/") {
				src = rootURL + src;
			}
			// otherwise, assume page-relative
			else {
				src = rootPageDir + src;
			}
		}

		return src;
	}

	// create an instance of $LAB
	function createSandbox() {
		var registry = {};
		var defaults = {};

		defaults[optAlwaysPreserveOrder] = false;
		defaults[optCacheBust] = false;
		defaults[optDebug] = false;
		defaults[optBasePath] = "";

		if (perfTiming) {
			registerMarkupLinks();
		}

		// API for each initial $LAB instance (before chaining starts)
		var publicAPI = {
			setGlobalDefaults: setGlobalDefaults,
			setOptions: setOptions,
			script: script,
			wait: wait,
			sandbox: createSandbox,
			noConflict: noConflict,
		};

		return publicAPI;


		// **************************************

		function registerMarkupLinks() {
			for (var i = 0; i < linkElems.length; i++) {
				(function loopScope(elem){
					if (
						elem &&
						/\bpreload\b/i.test( elem.getAttribute( "rel" ) )
					) {
						// must have the `as` attribute
						var preloadAs = elem.getAttribute( "as" );
						if (!preloadAs) return;

						// canonicalize resource URL and look it up in the global performance table
						var href = elem.getAttribute( "href" );
						href = canonicalURL( href, document.baseURI );	// TODO: fix document.baseURI here
						var perfEntries = context.performance.getEntriesByName( href );

						// already registered this resource?
						if (href in registry) return;

						// add global registry entry
						var registryEntry = new createRegistryEntry( null, href );
						registryEntry.preloadRequested = true;
						registry[href] = registryEntry;

						// resource already (pre)loaded?
						if (perfEntries.length > 0) {
							registryEntry.preloaded = true;
							console.log( "markup link already preloaded", href );
						}
						else {
							console.log( "listening for markup link preload", href );
							// listen for preload to complete
							elem.addEventListener( "load", function resourcePreloaded(){
								console.log("markup link preloaded!",href);
								elem.removeEventListener( "load", resourcePreloaded );
								registryEntry.preloaded = true;
								notifyRegistryListeners( registryEntry );
							} );
						}
					}
				})( linkElems[i] );
			}
		}

		// rollback `context.$LAB` to what it was before this file
		// was loaded, then return this current instance of $LAB
		function noConflict() {
			context.$LAB = old$LAB;
			return publicAPI;
		}

		function setGlobalDefaults(opts) {
			defaults = assign( defaults, opts );
			return publicAPI;
		}

		function setOptions() {
			return createChainInstance().setOptions.apply( null, arguments );
		}

		function script() {
			return createChainInstance().script.apply( null, arguments );
		}

		function wait() {
			return createChainInstance().wait.apply( null, arguments );
		}

		function createGroupEntry(check) {
			this.isGroup = true;
			this.resources = [];
			this.ready = false;
			this.complete = false;
			this.check = check || function(){};
		}

		function createRegistryEntry(type,src) {
			this.type = type;
			this.src = src;
			this.listeners = [];
			this.preloadRequested = false;
			this.preloaded = false;
			this.loadRequested = false;
			this.complete = false;
			this.opts = null;
		}

		function registerResource(resourceRecord) {
			// registry entry doesn't exist yet?
			if (!(resourceRecord.src in registry)) {
				registry[resourceRecord.src] = new createRegistryEntry( resourceRecord.type, resourceRecord.src );
			}

			var registryEntry = registry[resourceRecord.src];

			// still need to set the type for this entry?
			if (!registryEntry.type) {
				registryEntry.type = resourceRecord.type;
			}

			// any `resourceRecord` options to store?
			if (!registryEntry.opts) {
				registryEntry.opts = resourceRecord.opts;
			}

			// need to add `resourceRecord` as a listener for registry entry updates?
			if (!~registryEntry.listeners.indexOf( resourceRecord )) {
				registryEntry.listeners.push( resourceRecord );
			}

			return registryEntry;
		}

		function notifyRegistryListeners(registryEntry) {
			var groups = [];

			// collect all of the affected groups
			for (var i = 0; i < registryEntry.listeners.length; i++) {
				if (!~groups.indexOf( registryEntry.listeners[i].group )) {
					groups.push( registryEntry.listeners[i].group );
				}
			}

			// schedule all the group checks
			for (var i = 0; i < groups.length; i++) {
				groups[i].check();
			}
		}

		function createChainInstance() {
			var chainOpts = assign( {}, defaults );
			var chain = [];
			var checkHook;

			var chainAPI = {
				setOptions: setOptions,
				script: script,
				wait: wait,
			};

			return chainAPI;


			// **************************************

			function setOptions(opts) {
				chainOpts = assign( chainOpts, opts );
				return chainAPI;
			}

			function script() {
				for (var i = 0; i < arguments.length; i++) {
					addChainResource( "script", arguments[i] );
				}
				scheduleChainCheck();

				return chainAPI;
			}

			function wait() {
				if (arguments.length > 0) {
					for (var i = 0; i < arguments.length; i++) {
						addChainWait( arguments[i] );
					}
				}
				else {
					// placeholder wait entry
					addChainWait( /*waitEntry=*/true );
				}
				scheduleChainCheck();

				return chainAPI;
			}

			function addChainResource(resourceType,resourceRecord) {
				// need to add next group to chain?
				if (
					chain.length == 0 ||
					!chain[chain.length - 1].isGroup ||
					chain[chain.length - 1].complete ||
					(!realPreloading && !scriptOrderedAsync) ||		// TODO: only apply these checks for scripts
					(chainOpts[optAlwaysPreserveOrder] && !scriptOrderedAsync)
				) {
					var groupEntry = new createGroupEntry( scheduleChainCheck );
					chain.push( groupEntry );
				}

				var currentGroup = chain[chain.length - 1];
				currentGroup.complete = false;

				// format resource record and canonicalize URL
				if (typeof resourceRecord == "string") {
					resourceRecord = {
						type: resourceType,
						src: canonicalURL( resourceRecord, chainOpts[optBasePath] ),
						group: currentGroup,
					};
				}
				else {
					resourceRecord = {
						type: resourceType,
						src: canonicalURL( resourceRecord.src, chainOpts[optBasePath] ),
						opts: resourceRecord,
						group: currentGroup,
					};
				}

				// add resource to current group
				currentGroup.resources.push( resourceRecord );

				// add/lookup resource in the global registry
				var registryEntry = registerResource( resourceRecord );

				// need to start preloading this resource?
				if (realPreloading && !registryEntry.preloadRequested) {
					var elem = preloadResource( registryEntry );

					// listen for preload to complete
					elem.addEventListener( "load", function resourcePreloaded(){
						console.log("resource preloaded!",resourceRecord.src);
						elem.removeEventListener( "load", resourcePreloaded );
						elem.parentNode.removeChild( elem );
						registryEntry.preloaded = true;
						notifyRegistryListeners( registryEntry );
					} );
				}
			}

			function addChainWait(waitEntry) {
				// need empty group placeholder at beginning of chain?
				if (chain.length == 0) {
					var groupEntry = new createGroupEntry();
					groupEntry.ready = groupEntry.complete = true;
					chain.push( groupEntry );
				}

				chain.push( {wait: waitEntry} );
			}

			function scheduleChainCheck() {
				if (checkHook == null) {
					checkHook = setTimeout( advanceChain, 0 );
				}
			}

			function advanceChain() {
				checkHook = null;

				for (var i = 0; i < chain.length; i++) {
					if (!chain[i].complete) {
						if (chain[i].isGroup) {
							checkGroupStatus( chain[i] );

							if (!chain[i].complete) {
								break;
							}
						}
						else if (typeof chain[i].wait == "function") {
							try {
								chain[i].wait();
								chain[i].complete = true;
							}
							catch (err) {
								if (chainOpts[optDebug]) {
									throwGlobalError( err );
								}
								else {
									logError( err );
								}
								break;
							}
						}
						else {
							chain[i].complete = true;
						}
					}
				}
			}

			function checkGroupStatus(group) {
				// is group in need of potential preload processing?
				if (!group.ready && !group.complete) {
					if (realPreloading) {
						var groupReady = true;
						for (var i = 0; i < group.resources.length; i++) {
							if (!registry[group.resources[i].src].preloaded) {
								groupReady = false;
								break;
							}
						}
						group.ready = groupReady;
					}
					else {
						group.ready = true;
					}
				}

				if (!group.complete && group.ready) {
					var groupComplete = true;

					for (var i = 0; i < group.resources.length; i++) {
						(function loopScope(resourceRecord){
							var registryEntry = registry[resourceRecord.src];

							// resource loading not yet requested?
							if (!registryEntry.loadRequested) {
								var elem = loadResource( registryEntry );

								// listen for load to complete
								elem.addEventListener( "load", function resourceLoaded(){
									console.log("resource loaded!",resourceRecord.src);
									elem.removeEventListener( "load", resourceLoaded );
									registryEntry.complete = true;
									notifyRegistryListeners( registryEntry );
								} );

								groupComplete = false;
							}
							// resource loading already complete?
							else if (registryEntry.complete) {
								return;
							}
							else {
								groupComplete = false;

								// need to register `resourceRecord` as a listener for currently
								// loading (not yet complete) resource?
								if (!~registryEntry.listeners.indexOf( resourceRecord )) {
									registryEntry.listeners.push( resourceRecord );
								}
							}
						})( group.resources[i] );
					}

					if (groupComplete) {
						group.complete = true;
					}
				}
			}
		}
	}
});
