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
		opts = opts || {};
		if (!("relList" in opts)) opts.relList = true;
		if (!("scriptAsync" in opts)) opts.scriptAsync = true;
		if (!("linkPreload" in opts)) opts.linkPreload = true;
		if (!("baseURI" in opts)) opts.baseURI = "";

		var documentElement = createElement( "document" );
		documentElement.head = createElement( "head" );
		documentElement.body = createElement( "body" );
		documentElement.baseURI = opts.baseURI;
		documentElement.createElement = createElement;

		var performanceAPI = {
			getEntriesByName: getEntriesByName,
		};

		var mockDOM = createElement( "window" );
		mockDOM.document = documentElement;
		mockDOM.performance = performanceAPI;

		// setup Element prototype
		Element.prototype.getElementsByTagName = getElementsByTagName;
		Element.prototype.appendChild = appendChild;
		Element.prototype.removeChild = removeChild;
		Element.prototype.setAttribute = setAttribute;
		Element.prototype.getAttribute = getAttribute;
		Element.prototype.addEventListener = addEventListener;
		Element.prototype.removeEventListener = removeEventListener;

		return mockDOM;


		// **************************************

		// document.createElement(..)
		function createElement(tagName) {
			tagName = tagName.toLowerCase();

			var element = new Element();
			element.tagName = tagName.toUpperCase();

			if (tagName == "script") {
				element.async = !!opts.scriptAsync;
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
			this.tagNameTagNameNodeLists = {};
			this._eventHandlers = {};
		}

		// Element#getElementsByTagName(..)
		function getElementsByTagName(tagName) {
			this.tagNameTagNameNodeLists[tagName] = this.tagNameTagNameNodeLists[tagName] || [];
			return this.tagNameTagNameNodeLists[tagName];
		}

		// Element#appendChild(..)
		function appendChild(childElement) {
			this.childNodes.push( childElement );
			childElement.parentNode = this;
			updateTagNameNodeLists( childElement );

			if (childElement.tagName == "link" && childElement.rel == "preload") {
				// TODO: simulate resource preloading
			}
			else if (/^(?:script|link|img)$/.test( childElement.tagName )) {
				// TODO: simulate resource loading
			}

			return childElement;
		}

		// Element#removeChild(..)
		function removeChild(childElement) {
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
			this[attrName] = attrValue;
		}

		// Element#getAttribute(..)
		function getAttribute(attrName) {
			return this[attrName];
		}

		// Element#addEventListener(..)
		function addEventListener(evtName,handler) {
			this._evtHandlers[evtName] = this._evtHandlers[evtName] || [];
			this._evtHandlers[evtName].push( handler );
		}

		// Element#removeEventListener(..)
		function removeEventListener(evtName,handler) {
			if (this._evtHandlers[evtName]) {
				var idx = this._evtHandlers[evtName].indexOf( handler );
				this._evtHandlers[evtName].splice( idx, 1 );
			}
		}

		// Element#relList.supports(..)
		function supports(feature) {
			if (feature == "preload" && opts.linkPreload && this._parent.tagName == "link") {
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
				el.tagNameTagNameNodeLists[element.tagName] = el.tagNameTagNameNodeLists[element.tagName] || [];
				if (!~el.tagNameTagNameNodeLists[element.tagName].indexOf( element )) {
					el.tagNameTagNameNodeLists[element.tagName].push( element );
				}
				el = el.parentNode;
			}
		}

		function filterTagNameNodeLists(element) {
			var el = element.parentNode;

			// recursively walk up the element tree
			while (el != null) {
				var idx;
				if (el.tagNameTagNameNodeLists[element.tagName] && (idx = el.tagNameTagNameNodeLists[element.tagName].indexOf( element )) != -1) {
					el.tagNameTagNameNodeLists[element.tagName].splice( idx, 1 );
				}
				el = el.parentNode;
			}
		}
	}
});
