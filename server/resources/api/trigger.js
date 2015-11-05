/**
 *	@fileoverview Resource to handle REST requests for Devices
 *	@author Joel Oliveira <joel@notifica.re>
 *	@copyright Notificare
 *	@version 0.1
 */

var express = require('express'),
	NotificarePush = require('../../libs/notificare/push');

module.exports = TriggerResource = function() {};

TriggerResource.prototype = {
	attach: function(app) {
		this.app = app;
		this.adapter = new NotificarePush({
			protocol: app.set('push').protocol,
			host: app.set('push').host
		});
		return express.Router()
			.post('/:type', this.routes.trigger.bind(this));
	},
	
	routes: {
		trigger: function(request, response, next) {
			this.adapter.post('/trigger/:type', {
				type: request.params.type
			}, null, request.body, {
				auth: {
					username: this.app.set('notificare').key,
					password: this.app.set('notificare').secret
				}
			}, function(err, clientResponse, body) {
				if (err) {
					next(err);
				} else if (clientResponse.statusCode >= 400) {
					response.status(clientResponse.statusCode).send(body.error);
				} else {
					response.status(201).send(body);
				}
			}.bind(this));
		}
	}
};