// # Notificare JS SDK
// ## Main Node file
// Set the following environment variables to use:
//
// - NOTIFICARE_KEY		Get your Application Key from Notificare Dashboard
// - NOTIFICARE_SECRET	Get your Application Secret from Notificare Dashboard

// ## Imports
var express = require('express'),
	API = require('./server/resources/api'),
	connectRedis = require('connect-redis');

require('express-namespace');

//Create an ExpressJS app
var app = express();
//var RedisStore = connectRedis(express);

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
	app.set('push', {
		protocol: process.env.PUSH_API_PROTOCOL || 'http',
		host: process.env.PUSH_API_HOST || 'localhost:3333'
	});
	app.set('notificare', {
		key: process.env.NOTIFICARE_KEY || '1a76f1518a4b7f09548889c926fddc42a05ecd7bb5e60f494635e8839dbfd952',
		secret: process.env.NOTIFICARE_SECRET || 'c00aae19e159dfd48b76d2c072d094e28ce0215920b76f45a4d72375309ae5d3',
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
		key: process.env.NOTIFICARE_KEY || '1a76f1518a4b7f09548889c926fddc42a05ecd7bb5e60f494635e8839dbfd952',
		secret: process.env.NOTIFICARE_SECRET || 'c00aae19e159dfd48b76d2c072d094e28ce0215920b76f45a4d72375309ae5d3',
	});

});


// Map routes to resource namespaces, pass along the Express app instance
app.namespace('/api', new API().attach(app));

// Ready to go, start the bunker!
var port = process.env.PORT || 3333;
app.listen(port, function() {
	console.log("%s [INFO] Listening on %s", Date(), port);
});
