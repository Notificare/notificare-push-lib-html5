MyApp.ApplicationRoute = Ember.Route.extend({
	model: function(){
		return null;
	},
	setupController:function(controller, model) {
		Ember.run.later(function(){
			controller.start();
		}, 1000);
	}
});