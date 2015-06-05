/**
 *	@fileoverview Resource to handle REST requests for Devices
 *	@author Joel Oliveira <joel@notifica.re>
 *	@copyright Notificare
 *	@version 0.1
 */

var express = require('express'),
	NotificarePush = require('../../libs/notificare/push');

module.exports = ReplyResource = function() {};

ReplyResource.prototype = {
	attach: function(app) {
		this.app = app;
		this.adapter = new NotificarePush({
			protocol: app.set('push').protocol,
			host: app.set('push').host
		});
		return express.Router()
			.post('/', this.routes.create.bind(this));
	},
	
	routes: {
		create: function(request, response, next) {
			this.adapter.post('/reply', null, null, request.body, {
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
					response.status(201).send({reply: body});
				}
			}.bind(this));
		}
	}
};