// # Notificare Push Library for WebSockets
// ## Main Node file
// Set the following environment variables to use:
//
// - NOTIFICARE_KEY		Get your Application Key from Notificare Dashboard
// - NOTIFICARE_SECRET	Get your Application Secret from Notificare Dashboard

// ## Imports
var express = require('express'),
	API = require('./server/resources/api');

require('express-namespace');

//Create an ExpressJS app
var app = express();

// default configuration
app.configure(function(){
	// Language handler
	app.use(express.logger(':remote-addr - - [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));
	app.use(express.cookieParser());
	app.use(express.bodyParser());
	app.use(express.static(__dirname + '/client/build'));
	app.use(function(req, res, next) {
		req.language = req.acceptedLanguages[0] || 'en';
		next();
	});
	// Generic error handler
	app.use(function(err, request, response, next) {
		console.log('%s [ERROR] %s', Date(), err.message);
		response.send(500, {error: 'Fail whale'});
	});
});

// local environment configuration
app.configure('development', function() {
	app.enable('trust proxy');
	app.set('push', {
		protocol: 'https',
		host: 'push.notifica.re'
	});
	app.set('notificare', {
		key: process.env.NOTIFICARE_KEY || '',
		secret: process.env.NOTIFICARE_SECRET || ''
	});
});

// production environment configuration
app.configure('production', function() {
	app.enable('trust proxy');
	app.set('push', {
		protocol: 'https',
		host: 'push.notifica.re'
	});
	app.set('notificare', {
		key: process.env.NOTIFICARE_KEY || '',
		secret: process.env.NOTIFICARE_SECRET || ''
	});

});


// Map routes to resource namespaces, pass along the Express app instance
app.namespace('/api', new API().attach(app));

// Ready to go, start the bunker!
var port = process.env.PORT || 3333;
app.listen(port, function() {
	console.log("%s [INFO] Listening on %s", Date(), port);
});
