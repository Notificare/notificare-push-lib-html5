/**
 *	@fileoverview Resource to handle REST requests for Devices
 *	@author Joel Oliveira <joel@notifica.re>
 *	@copyright Notificare
 *	@version 0.1
 */

var express = require('express'),
	NotificarePush = require('../../libs/notificare/push');

module.exports = DeviceResource = function() {};

DeviceResource.prototype = {
	attach: function(app) {
		this.app = app;
		this.adapter = new NotificarePush({
			protocol: app.set('push').protocol,
			host: app.set('push').host
		});
		return express.Router()
			.get('/', this.routes.index.bind(this))
			.post('/', this.routes.create.bind(this))
			.put('/:id', this.routes.update.bind(this))
			.get('/:id/tags', this.routes.index.bind(this))
			.put('/:id/cleartags', this.routes.clearTags.bind(this))
			.put('/:id/removetag', this.routes.removeTag.bind(this))
			.put('/:id/addtags', this.routes.addTags.bind(this));
	},
	
	routes: {
		index: function(request, response, next) {
			this.adapter.get('/device/:id/tags', {
				id: request.params.id
			}, null, {
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
					response.status(201).send({tags: body.tags});
				}
			}.bind(this));
		},
		
		create: function(request, response, next) {
			this.adapter.post('/device', null, null, request.body, {
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
					response.status(201).send({device: body});
				}
			}.bind(this));
		},
		
		update: function(request, response, next) {
			this.adapter.put('/device/:id', {
				id: request.params.id
			}, null, request.body, {
				auth: {
					username: this.app.set('notificare').key,
					password: this.app.set('notificare').secret,
				}
			}, function(err, clientResponse, body) {
				if (err) {
					next(err);
				} else if (clientResponse.statusCode >= 400) {
					response.status(clientResponse.statusCode).send(body.error);
				} else {
					response.status(200).send({device: body});
				}
			}.bind(this));
		},
		
		clearTags: function(request, response, next) {
			this.adapter.put('/device/:id/cleartags', {
				id: request.params.id
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
					response.status(200).send({device: body});
				}
			}.bind(this));
		},
		
		addTags: function(request, response, next) {
			this.adapter.put('/device/:id/addtags', {
				id: request.params.id
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
					response.status(200).send({device: body});
				}
			}.bind(this));
		},
		
		removeTag: function(request, response, next) {
			this.adapter.put('/device/:id/removetag', {
				id: request.params.id
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
					response.status(200).send({device: body});
				}
			}.bind(this));
		},
		
		destroy: function(request, response, next) {
			this.adapter.del('/device/:id', {
				id: request.params.id
			}, null, {
				auth: {
					username: this.app.set('notificare').key,
					password: this.app.set('notificare').secret
				}
			}, function(err, clientResponse, body) {
				if (err) {
					next(err);
				} else if (clientResponse.statusCode != 200) {
					response.status(clientResponse.statusCode).send(body.error);
				} else {
					
					response.status(200).send({});
					
				}
			}.bind(this));
		},
	}
};