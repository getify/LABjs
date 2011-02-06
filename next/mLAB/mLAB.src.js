/*! mLAB.js (Module-LABjs :: Loading And Blocking JavaScript Modules)
    v0.1a (c) Kyle Simpson
    MIT License
*/

(function(global){
	var modules = [],
		module_chains = [],
		module_registry = {},
		
		current_chain_id = 0
	;
	
	function create_chain() {
		var chain_id = modules.length,
			chain_group_id = 0,
			publicAPI
		;

		modules[chain_id] = [];
		
		module_chains[chain_id] = publicAPI = {
			require:function(){ return publicAPI; },
			define:function(){ return; }
		};
		return publicAPI;
	}
	
	global.$MLAB = {
		require:function(){
			return global.$MLAB;
		},
		then:function(){
			return global.$MLAB;
		},
		module:function(){
			return module_chains[current_chain_id];
		}
	};

})(window);