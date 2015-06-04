/**
 * @fileoverview Global API handler for Notificare JS SDK
 * @author Joris Verbogt <joris@notifica.re>
 * @author Joel Oliveira <joel@notifica.re>
 */
var express = require('express'),
	NotificationResource = require('./notification'),
	DeviceResource = require('./device'),
	EventResource = require('./event'),
	ReplyResource = require('./reply');


module.exports = API = function(options) {
	options = options || {};
	this.options = {};
};
	
API.prototype = {
	attach: function(app) {
		this.app = app;
		this.adapter = new NotificarePush({
			protocol: app.set('push').protocol,
			host: app.set('push').host
		});
		return express.Router()
			.use('/notifications', new NotificationResource().attach(app))
			.use('/devices', new DeviceResource().attach(app))
			.use('/events', new EventResource().attach(app))
			.use('/replies', new ReplyResource().attach(app));
	}
};