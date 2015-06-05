/**
 *	@fileoverview Resource to handle REST requests for Notifications
 *	@author Joris Verbogt <joris@notifica.re>
 *	@copyright Notificare
 *	@version 0.1
 */

var express = require('express'),
	async = require('async'),
	NotificarePush = require('../../libs/notificare/push');

module.exports = NotificationResource = function() {};

NotificationResource.prototype = {
	attach: function(app) {
		this.app = app;
		this.adapter = new NotificarePush({
			protocol: app.set('push').protocol,
			host: app.set('push').host
		});
		return express.Router()
			.get('/:id', this.routes.show.bind(this));
	},
	routes: {
		show: function(request, response, next){
			this.adapter.get('/notification/:id', {
				id: request.params.id
			}, null, {
				auth: {
					username: this.app.set('notificare').key,
					password: this.app.set('notificare').secret,
				}
			}, function(err, clientResponse, body) {
				if (err) {
					next(err);
				} else if (200 != clientResponse.statusCode) {
					response.status(clientResponse.statusCode).send(body.error);
				} else {
					response.status(200).send({notification: body.notification});
				}
			}.bind(this));
		}
	}
};