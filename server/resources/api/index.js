/**
 * @fileoverview Global API handler for Notificare JS SDK
 * @author Joris Verbogt <joris@notifica.re>
 * @author Joel Oliveira <joel@notifica.re>
 */
var NotificationResource = require('./notification'),
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
		return function() {
			app.namespace('/notifications', new NotificationResource().attach(app));
			app.namespace('/devices', new DeviceResource().attach(app));
			app.namespace('/events', new EventResource().attach(app));
			app.namespace('/replies', new ReplyResource().attach(app));
		}.bind(this);
	}
};