// Notificare Push Library for HTML5
// Check public/index.html for implementation
// This express app is solely used for local development
// Copy the contents of /public to your web server for production environment

var express = require('express'),
    morgan = require('morgan');

//Create an ExpressJS app
var app = express();

// Middleware
app.use(morgan(':remote-addr - - [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));
app.use(express.static(__dirname + '/public'));

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