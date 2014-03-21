/**
 * @fileoverview API adapter for Notificare Push API
 * @author Joris Verbogt <joris@notifica.re>
 * @copyright Notificare BV
 * @version 0.1
 */
var url = require('url'),
	Request = require('request'),
	S = require('string');

/**
 * Constructor
 * @param options
 * 	- protocol {String} The protocol to use, http or https
 * 	- host {String} The host to connect to for Push API calls
 * @returns {NotificarePush}
 */
module.exports = NotificarePush = function(options) {
	options = options || {};
	this.options = {
		protocol: options.protocol || 'http',
		host: options.host || 'localhost:3006'
	};
};

/**
 * Call the Notificare Push API
 * @param {String} HTTP method
 * @param {String} path
 * @param {Object} params to be replaced in path
 * @param {Object} query parameters
 * @param {Object} body of the call
 * @param {Object} options
 * 	- auth username/password
 * 	- contentType 
 * @param {Function} callback
 * @returns {Request}
 */
NotificarePush.prototype._call = function(method, path, params, query, body, options, done) {
	options = options || {};
	var placeholders = path.match(new RegExp('\:[a-zA-Z0-9]+', 'g'));
	if (placeholders) {
		placeholders.forEach(function(placeholder) {
			var param = placeholder.replace(':','');
			path = path.replace(placeholder, encodeURIComponent(params[param]));
		});		
	}
	var requestOptions = {
		uri: url.format({
			protocol: this.options.protocol,
			host: this.options.host,
			pathname: path,
			query: query
		}),
		_json: true
	};
	if (options.auth) {
		requestOptions.auth = options.auth;
	}
	if (options.headers) {
		requestOptions.headers = options.headers;
	} else {
		requestOptions.json = true;
	}
	if ('post' == method || 'put' == method) {
		requestOptions.body = body;
	}
	return Request[method](requestOptions, done);
};

/**
 * GET request
 * @param path
 * @param params
 * @param query
 * @param options
 * @param done
 * @returns {Request}
 */
NotificarePush.prototype.get = function(path, params, query, options, done) {
	return this._call('get', path, params, query, null, options, done);
};

/**
 * POST request
 * @param path
 * @param params
 * @param query
 * @param body
 * @param options
 * @param done
 * @returns {Request}
 */
NotificarePush.prototype.post = function(path, params, query, body, options, done) {
	return this._call('post', path, params, query, body, options, done);
};

/**
 * PUT request
 * @param path
 * @param params
 * @param query
 * @param body
 * @param options
 * @param done
 * @returns {Request}
 */
NotificarePush.prototype.put = function(path, params, query, body, options, done) {
	return this._call('put', path, params, query, body, options, done);
};

/**
 * DELETE request
 * @param path
 * @param params
 * @param query
 * @param options
 * @param done
 * @returns {Request}
 */
NotificarePush.prototype.del = function(path, params, query, options, done) {
	return this._call('del', path, params, query, null, options, done);
};

/**
 * Transform the keys in an object
 * @param {Object} the object
 * @param {Function} the transformation on the key
 * @returns {Mixed} the transformed object (deep copy)
 */
NotificarePush.prototype._transformObjectKeys = function(object, transform) {
	if ('object' == typeof object) {
		if (object == null) {
			return null;
		} else if (object instanceof Array) {
			// Loop over inner arrays
			var result = []; 
			object.forEach(function(item) {
				result.push(this._transformObjectKeys(item, transform));
			}.bind(this));
			return result;
		} else {
			// It's an object, transform all keys
			var result = {};
			Object.keys(object).forEach(function(key) {
				// Transform the key
				result[transform(key)] = this._transformObjectKeys(object[key], transform);
			}.bind(this));
			return result;
		}
	} else {
		return object;
	}
};

/**
 * Transform a Notificare model to an Ember model, i.e., underscore keys and remove _id and __v
 * @param {Object} Notificare model
 * @returns {Object} Ember model
 */
NotificarePush.prototype.transformToEmber = function(model) {
	var emberModel = this._transformObjectKeys(model, function(key) {
		if ("_id" == key) {
			return "id";
		} else {
			return S(key).underscore();
		}
	});
	delete emberModel._id;
	delete emberModel.__v;
	return emberModel;
};
	
/**
 * Transform an Ember model to a Notificare model, i.e., camelize keys
 * @param {Object} Ember model
 * @returns {Object} Notificare model
 */
NotificarePush.prototype.transformToNotificare = function(model) {
	return this._transformObjectKeys(model, function(key) {
		if ("id" == key) {
			return "_id";
		} else {
			return S(key).camelize();
		}
	});
};
