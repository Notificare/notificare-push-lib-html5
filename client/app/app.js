/*
 * This is an Ember Application (emberjs.com)
 * Ember uses jQuery (jquery.com) and Handlebars (handlebarsjs.com) - import them by that order!
 * Ember gives you a JS MVC Framework to develop ambitious web apps
 * The whole application is generated and minified using the Gruntfile.js
 */

/*
	Get our generated templates
*/
require('dependencies/compiled/templates');

/*
  Creates a new instance of an Ember application and
  specifies what HTML element inside index.html Ember
  should manage for you.
*/
window.MyApp = Ember.Application.create({
	rootElement: window.TESTING ? '#qunit-fixture' : '#myapp',
	ready: function () {
		$("#loader").remove();
	}
});



/*
 * When running a test
 */
if (window.TESTING) {
  window.MyApp.deferReadiness();
}

/* 
 * Model layer. 
 * Ember.Object itself provides most of what
 * model layers elsewhere provide. Since TodoMVC
 * doesn't communicate with a server, plain
 * Ember.Objects will do.
*/
//require('app/models/notification');
//require('app/models/device');



/*
 * Views layer.
 * You'll notice that there are only a few views.
 * Ember accomplishes a lot in its templates and 
 * Views are only necessary if you have view-specific
 * programming to do. 
*/
//require('app/views/dashboard');


/*
 * Controller layer.
 * Controllers wrap objects and provide a place
 * to implement properties for display
 * whose value is computed from the content of the
 * controllers wrapped objects.
*/
require('app/controllers/application');


/* 
 * States (i.e. Routes)
 * Handles serialization of the application's current state
 * which results in view hierarchy updates. Responds to
 * actions.
*/
require('app/routes/router');

