$MLAB.module()

.require({"yetanother":"http://domain.tld/yetanothermodule.js"})

.define("another", function($M){
	return {
		bar:function() { return 5 * $M.yetanother.yum(5); }
	};
});