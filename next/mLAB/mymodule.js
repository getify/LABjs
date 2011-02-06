$MLAB.module()

.require("someother")
.require({"another":"http://domain.tld/anothermodule.js"})
.require("yetanother")

.define("my", function($M){
	var someother = $M.someother,
		another = $M.another,
		yetanother = $M.yetanother,
	;
	
	return {
		foobarbaz:function(){
			return someother.foo() + another.bar() + yetanother.baz();
		}
	};
})