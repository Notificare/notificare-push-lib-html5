// # Notificare Push Library for WebSockets
// ## Main Node file
// Set the following environment variables to use:
//
// - NOTIFICARE_KEY		Get your Application Key from Notificare Dashboard
// - NOTIFICARE_SECRET	Get your Application Secret from Notificare Dashboard

// ## Imports
var express = require('express'),
	cookieParser = require('cookie-parser'),
	bodyParser = require('body-parser'),
	morgan = require('morgan'),
	API = require('./server/resources/api');

//Create an ExpressJS app
var app = express();


var env = process.env.NODE_ENV || 'development';
if ('development' == env) {
	app.enable('trust proxy');
	app.set('push', {
		protocol: 'https',
		host: 'push.notifica.re'
	});
	app.set('notificare', {
		key: process.env.NOTIFICARE_KEY || 'af08ba316475891e85ebef94b121d41174359f2a63b4f61933239bb2656fa1ae',
		secret: process.env.NOTIFICARE_SECRET || '2752ab0ea031c50411e6052cf7c4fc224325d789a2d890bccfc2028dff4979c6'
	});
} else {
	app.enable('trust proxy');
	app.set('push', {
		protocol: 'https',
		host: 'push.notifica.re'
	});
	app.set('notificare', {
		key: process.env.NOTIFICARE_KEY || '',
		secret: process.env.NOTIFICARE_SECRET || ''
	});
}

// Middleware
app.use(morgan(':remote-addr - - [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/client/build'));
app.use(function(req, res, next) {
	req.language = req.acceptsLanguages[0] || 'en';
	next();
});

// Map routes to resource namespaces, pass along the Express app instance
app.use('/api', new API().attach(app));

//Generic error handler
app.use(function(err, request, response, next) {
	console.log('%s [ERROR] %s', Date(), err.message);
	if (err.status && err.status < 500) {
		response.status(err.status).send({error: err.message});
	} else {
		response.status(500).send({error: 'Fail whale'});
	}
});

// Ready to go, start the bunker!
var port = process.env.PORT || 3333;
app.listen(port, function() {
	console.log("%s [INFO] Listening on %s", Date(), port);
});
