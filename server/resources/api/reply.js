/**
 *	@fileoverview Resource to handle REST requests for Devices
 *	@author Joel Oliveira <joel@notifica.re>
 *	@copyright Notificare
 *	@version 0.1
 */

var NotificarePush = require('../../libs/notificare/push');
module.exports = ReplyResource = function() {};

ReplyResource.prototype = {
	attach: function(app) {
		this.app = app;
		this.adapter = new NotificarePush({
			protocol: app.set('push').protocol,
			host: app.set('push').host
		});
		return function() {
			app.post('/', this.routes.create.bind(this));
		}.bind(this);
	},
	
	routes: {
		create: function(request, response, next) {
			this.adapter.post('/reply', null, null, request.body, {
				auth: {
					username: this.app.set('notificare').key,
					password: this.app.set('notificare').secret,
				}
			}, function(err, clientResponse, body) {
				if (err) {
					next(err);
				} else if (clientResponse.statusCode >= 400) {
					response.send(clientResponse.statusCode, body.error);
				} else {
					response.send(201, {reply: body});
				}
			}.bind(this));
		}
	}
};