require('app/routes/application');
require('app/routes/index');

MyApp.Router.map(function() {	
	this.route('error');
	this.route('maintenance');
	this.route('server', { path: '/server-error'});
});

MyApp.Router.reopen({
	handleURL: function (url) {
		try {
			return this._super(url);
		} catch (error) {
			if (error.message.match(/No route matched the URL/)) {
				return this._super('/error');
			}
		}
	}
});



//MyApp.Router.reopen({
//	location: 'history'
//});