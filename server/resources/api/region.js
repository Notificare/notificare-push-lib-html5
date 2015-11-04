/**
 *	@fileoverview Resource to handle REST requests for Devices
 *	@author Joel Oliveira <joel@notifica.re>
 *	@copyright Notificare
 *	@version 0.1
 */

var express = require('express'),
	NotificarePush = require('../../libs/notificare/push');

module.exports = RegionResource = function() {};

RegionResource.prototype = {
	attach: function(app) {
		this.app = app;
		this.adapter = new NotificarePush({
			protocol: app.set('push').protocol,
			host: app.set('push').host
		});
		return express.Router()
			.get('/bylocation/:lat/:lng', this.routes.regionsByLocation.bind(this));
	},
	
	routes: {
		regionsByLocation: function(request, response, next) {
			this.adapter.get('/region/bylocation/:lat/:lng', {
				lat: request.params.lat,
				lng: request.params.lng
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
					response.status(200).send({regions: body.regions});
				}
			}.bind(this));
		}
	}
};