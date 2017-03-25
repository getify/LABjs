// Mock for DOM resource loading

(function UMD(name,context,definition){
	if (typeof define === "function" && define.amd) { define(definition); }
	else if (typeof module !== "undefined" && module.exports) { module.exports = definition(); }
	else { context[name] = definition(name,context); }
})("$DOM",this,function DEF(name,context){
	"use strict";

	return createDOM;


	// **************************************

	function createDOM(opts) {
		var headElement = {};
		var baseURI = "";

		var $performance = {
			getEntriesByName: getEntriesByName,
		};

		var $document = {
			head: headElement,
			baseURI: baseURI,
			getElementsByTagName: getElementsByTagName,
			createElement: createElement,
		};

		var publicAPI = {
			document: $document,
			performance: $performance,
		};

		return publicAPI;


		// **************************************

		function getElementsByTagName() {}
		function createElement() {}
		function getEntriesByName() {}
	}
});
