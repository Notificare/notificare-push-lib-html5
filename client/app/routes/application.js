MyApp.ApplicationRoute = Ember.Route.extend({
	setupController:function(controller, model) {
		Ember.run.later(function(){
			controller.start();
		}, 1000);
	}
});