$MLAB.module()

.define("yetanother", function($M){
	return {
		baz:function() { return 30; },
		yum:function(val) { return val - 1; }
	};
});