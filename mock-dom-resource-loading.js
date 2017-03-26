// Mock for DOM resource loading testing

(function UMD(name,context,definition){
	if (typeof define === "function" && define.amd) { define(definition); }
	else if (typeof module !== "undefined" && module.exports) { module.exports = definition(); }
	else { context[name] = definition(name,context); }
})("$DOM",this,function DEF(name,context){
	"use strict";

	return createMockDOM;


	// **************************************

	function createMockDOM(opts) {
		opts = opts ? JSON.parse( JSON.stringify( opts ) ) : {};
		if (!("relList" in opts)) opts.relList = true;
		if (!("scriptAsync" in opts)) opts.scriptAsync = true;
		if (!("linkPreload" in opts)) opts.linkPreload = true;
		if (!("baseURI" in opts)) opts.baseURI = "";
		if (!("log" in opts)) opts.log = function log(status) { console.log( JSON.stringify( status ) ); }
		if (!("error" in opts)) opts.error = function error(err) { throw err; };
		if (!("resources" in opts)) opts.resources = [];

		// setup Element prototype
		Element.prototype.getElementsByTagName = getElementsByTagName;
		Element.prototype.appendChild = appendChild;
		Element.prototype.removeChild = removeChild;
		Element.prototype.setAttribute = setAttribute;
		Element.prototype.getAttribute = getAttribute;
		Element.prototype.addEventListener = addEventListener;
		Element.prototype.removeEventListener = removeEventListener;
		Element.prototype.dispatchEvent = dispatchEvent;

		var loadQueue = [];
		var silent = true;

		var documentElement = createElement( "document" );
		documentElement.head = createElement( "head" );
		documentElement.body = createElement( "body" );
		documentElement.appendChild( documentElement.head );
		documentElement.appendChild( documentElement.body );
		documentElement.baseURI = opts.baseURI;
		documentElement.createElement = createElement;

		var performanceAPI = {
			getEntriesByName: getEntriesByName,
		};

		var mockDOM = createElement( "window" );
		mockDOM.document = documentElement;
		mockDOM.performance = performanceAPI;

		silent = false;

		// notify: internal IDs for built-ins
		opts.log( {window: mockDOM._internal_id} );
		opts.log( {document: documentElement._internal_id} );
		opts.log( {head: documentElement.head._internal_id} );
		opts.log( {body: documentElement.body._internal_id} );

		return mockDOM;


		// **************************************

		// document.createElement(..)
		function createElement(tagName) {
			tagName = tagName.toLowerCase();

			var element = new Element();
			element.tagName = tagName.toUpperCase();

			!silent && opts.log( {createElement: tagName, internal_id: element._internal_id} );

			if (tagName == "script") {
				element.async = !!opts.scriptAsync;
			}
			if (tagName == "link") {
				element.href = "";
			}
			if (/^(?:script|img)$/.test( tagName )) {
				element.src = "";
			}

			return element;
		}

		function Element() {
			this.tagName = null;
			this.parentNode = null;
			this.childNodes = [];
			if (opts.relList) {
				this.relList = {
					supports: supports,
					_parent: this,
				};
			}

			// ************
			this._internal_id = Math.floor( Math.random() * 1E6 );
			this._tagNameNodeLists = {};
			this._eventHandlers = {};
		}

		// Element#getElementsByTagName(..)
		function getElementsByTagName(tagName) {
			this._tagNameNodeLists[tagName] = this._tagNameNodeLists[tagName] || [];
			return this._tagNameNodeLists[tagName];
		}

		// Element#appendChild(..)
		function appendChild(childElement) {
			!silent && opts.log( {appendChild: childElement._internal_id, internal_id: this._internal_id} );

			this.childNodes.push( childElement );
			childElement.parentNode = this;
			updateTagNameNodeLists( childElement );

			if (childElement.tagName.toLowerCase() == "link" && childElement.rel == "preload") {
				var resource = findMatchingOptResource( childElement.href );

				if (resource) {
					fakePreload( resource, childElement );
				}
				else {
					opts.error( new Error( "appendChild: Preload resource not found (" + childElement.href + "; " + childElement._internal_id + ")" ) );
				}
			}
			else if (/^(?:script|link|img)$/i.test( childElement.tagName )) {
				var url = (/^(?:script|img)$/i.test( childElement.tagName )) ?
					childElement.src :
					childElement.href;
				var resource = findMatchingOptResource( url );

				if (resource) {
					// track load-order queue (for ordered-async on scripts)?
					if (opts.scriptAsync && childElement.tagName.toLowerCase() == "script" && childElement.async === false) {
						loadQueue.push( {url: url, element: childElement} );
					}

					fakeLoad( resource, childElement );
				}
				else {
					opts.error( new Error( "appendChild: Load resource not found (" + url + "; " + childElement._internal_id + ")" ) );
				}
			}
			else {
				!silent && opts.error( new Error( "appendChild: Unrecognized tag (" + childElement.tagName + "; " + childElement._internal_id + ")" ) );
			}

			return childElement;
		}

		// Element#removeChild(..)
		function removeChild(childElement) {
			opts.log( {removeChild: childElement._internal_id, internal_id: this._internal_id} );

			var idx = this.childNodes.indexOf( childElement );
			if (idx != -1) {
				this.childNodes.splice( idx, 1 );
			}
			filterTagNameNodeLists( childElement );
			childElement.parentNode = null;

			return childElement;
		}

		// Element#setAttribute(..)
		function setAttribute(attrName,attrValue) {
			opts.log( {setAttribute: attrName + " | " + attrValue, internal_id: this._internal_id} );

			this[attrName] = attrValue;
		}

		// Element#getAttribute(..)
		function getAttribute(attrName) {
			return this[attrName];
		}

		// Element#addEventListener(..)
		function addEventListener(evtName,handler) {
			opts.log( {addEventListener: evtName, internal_id: this._internal_id} );

			this._eventHandlers[evtName] = this._eventHandlers[evtName] || [];
			this._eventHandlers[evtName].push( handler );
		}

		// Element#removeEventListener(..)
		function removeEventListener(evtName,handler) {
			opts.log( {removeEventListener: evtName, internal_id: this._internal_id} );

			if (this._eventHandlers[evtName]) {
				var idx = this._eventHandlers[evtName].indexOf( handler );
				this._eventHandlers[evtName].splice( idx, 1 );
			}
		}

		// Element#dispatchEvent(..)
		function dispatchEvent(evt) {
			opts.log( {dispatchEvent: evt.type, internal_id: this._internal_id} );

			if (this._eventHandlers[evt.type]) {
				for (var i = 0; i < this._eventHandlers[evt.type].length; i++) {
					try { this._eventHandlers[evt.type][i].call( this, evt ); } catch (err) {}
				}
			}
		}

		// Element#relList.supports(..)
		function supports(rel) {
			if (rel == "preload" && opts.linkPreload && this._parent.tagName.toLowerCase() == "link") {
				return true;
			}
			return false;
		}

		// performance.getEntriesByName(..)
		function getEntriesByName(url) {
			if (~opts.performanceEntries.indexOf( url )) {
				return [url];
			}
			return [];
		}

		function updateTagNameNodeLists(element) {
			var el = element.parentNode;

			// recursively walk up the element tree
			while (el != null) {
				el._tagNameNodeLists[element.tagName] = el._tagNameNodeLists[element.tagName] || [];
				if (!~el._tagNameNodeLists[element.tagName].indexOf( element )) {
					el._tagNameNodeLists[element.tagName].push( element );
				}
				el = el.parentNode;
			}
		}

		function filterTagNameNodeLists(element) {
			var el = element.parentNode;

			// recursively walk up the element tree
			while (el != null) {
				var idx;
				if (el._tagNameNodeLists[element.tagName] && (idx = el._tagNameNodeLists[element.tagName].indexOf( element )) != -1) {
					el._tagNameNodeLists[element.tagName].splice( idx, 1 );
				}
				el = el.parentNode;
			}
		}

		function findMatchingOptResource(url) {
			for (var i = 0; i < opts.resources.length; i++) {
				if (opts.resources[i].url == url) {
					return opts.resources[i];
				}
			}
		}

		function fakePreload(resource,element) {
			setTimeout( function preload(){
				if (resource.preload === true) {
					var evt = createEvent( "load", element );
				}
				else {
					var evt = createEvent( "error", element );
				}

				element.dispatchEvent( evt );
			}, resource.preloadDelay || 0 );
		}

		function fakeLoad(resource,element) {
			if (resource.load === true) {
				var evt = createEvent( "load", element );
			}
			else {
				var evt = createEvent( "error", element );
			}

			setTimeout( function load(){
				// simulating ordered-async for <script> elements?
				if (opts.scriptAsync && element.tagName.toLowerCase() == "script" && element.async === false) {
					updateLoadQueue( resource.url, element, evt );
				}
				else {
					element.dispatchEvent( evt );
				}
			}, resource.loadDelay || 0 );
		}

		function createEvent(type,target) {
			return {
				type: type,
				name: type,
				target: target,
				currentTarget: target,
				bubbles: false,
				cancelable: false,
				composed: false,
				scoped: false,
				defaultPrevented: false,
				timestamp: Date.now(),
				isTrusted: true,
				eventPhase: 2, // Event.AT_TARGET
				preventDefault: function(){ this.defaultPrevented = true; },
				stopPropagation: function(){},
				stopImmediatePropagation: function(){},
			};
		}

		// ensures load event order (queue) for ordered-async
		function updateLoadQueue(url,element,evt) {
			var found = false;
			var dispatchReady = true;
			var idx = 0;

			while (loadQueue.length > 0 && idx < loadQueue.length) {
				// update queue item?
				if (loadQueue[idx].url == url && loadQueue[idx].element == element) {
					opts.log( {updateLoadQueue: url, internal_id: element._internal_id} );
					loadQueue[idx].evt = evt;
					found = true;
				}

				if (dispatchReady) {
					var entry = loadQueue[0];

					if (entry.evt) {
						entry.element.dispatchEvent( entry.evt );
						loadQueue.shift();
						// NOTE: since we're shifting off index 0, no need
						// to increment `idx`
					}
					else {
						dispatchReady = false;
						idx++;
					}
				}
				else {
					idx++;
				}
			}

			if (!found) {
				opts.error( new Error( "updateLoadQueue: Entry not found (" + url + "; " + element._internal_id + ")" ) );
			}
		}
	}
});
