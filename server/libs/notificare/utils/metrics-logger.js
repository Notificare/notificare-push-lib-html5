/**
 * @fileoverview A logger class for metrics to Amazon CloudWatch
 * @author Joris Verbogt <joris@notifica.re>
 * @version 0.1
 */
var AWS = require('aws-sdk');

/**
 * Create a new AWS metrics logger
 * @param options
 * 	- interval
 * 	- namespace
 * 	- accessKeyId
 * 	- secretAccessKey
 * 	- region
 * @returns {AWSMetricsLogger}
 */
module.exports = AWSMetricsLogger = function(options) {
	this.interval = options.interval || 10000;
	this.serviceId = options.serviceId;
	AWS.config.update({
		accessKeyId: options.accessKeyId, 
		secretAccessKey: options.secretAccessKey, 
		region: options.region,
		sslEnabled: true
	});
	this._cloudwatch = new AWS.CloudWatch();
	this._metrics = {};
	this._startTimer();
};

AWSMetricsLogger.prototype = {
	/**
	 * Add a metric, will log 0 automatically if not updated
	 * @param name {String}
	 */
	addMetric: function(name) {
		if (!this._metrics[name]) {
			this._metrics[name] = 0;
		}
	},
	/**
	 * Remove a metric, will stop logging to AWS
	 * @param name {String}
	 */
	removeMetric: function(name) {
		delete this._metrics[name];
	},
	/**
	 * Log a metric, create it if not existing yet
	 * @param name {String}
	 */
	logMetric: function(name) {
		if (this._metrics[name] == null) {
			this._metrics[name] = 0;
		} else {
			this._metrics[name]++;
		}
	},
	/**
	 * @api private
	 * Start the timer
	 */
	_startTimer: function() {
		this._timer = setInterval(this._postMetrics.bind(this), this.interval);
	},
	/**
	 * @api private
	 * Post the metrics to AWS
	 */
	_postMetrics: function() {
		var data = [],
			now = new Date();
		Object.keys(this._metrics).forEach(function(name) {
			data.push({
				MetricName: name,
				Dimensions: [{
					Name: 'serviceId',
					Value: this.serviceId
				}],
				Value: this._metrics[name],
				Timestamp: now,
				Unit: 'Count'
			});
			this._metrics[name] = 0;
		}.bind(this));
		this._cloudwatch.putMetricData({
			Namespace: 'NotificareDashboardAPI',
			MetricData: data
		}, function(err, result) {
			if (err) {
				console.log('%s ERROR Could not log metrics: %s', Date(), err.message);
			}
		});
	}
};