MyApp.ApplicationController = Ember.Controller.extend({
	uniqueId: null,
	deviceId: null,
	userId: null,
	userName: null,
	timestamp: null,
	notification: null,
	config:{
		name: 'My App',
		version: '1.0',
		sdk: '1.0-RC1',
		api: "/api",
		wss: "wss://websocket.notifica.re",
		protocols: ['notificare-push'],
		daysToExpire: '30',
		clientInfo: new UAParser(),
		native: true,
		debug: false,
		minReconnectTimeout: 1000,
		maxReconnectTimeout: 60000
	},
	reconnectTimeout: 0,
	start: function(){

		if(this.config.native){
			if (window.webkitNotifications) {
				this.debug('Notificare: Native notifications are supported');
				
				 if (window.webkitNotifications.checkPermission() == 0) {
					this.debug('Notificare: Open Connection');
					this.openConnection();
					this.set('uniqueId', this.getUniqueId());
					this.set('timestamp', new Date());
					this.log({
					    sessionID: this.uniqueId,
					    type: 're.notifica.event.application.Open'
					});
				}else{
					this.debug('Notificare: Show Modal');
					$('#modal-simple-auth').modal('show');
					var _this = this;
					$('#accept-notifications').click(function(e) {
						_this.debug('Notificare: Accept Native?');
						e.preventDefault();
						window.webkitNotifications.requestPermission(function(e){
							this.debug('Notificare: Accepted');
							this.openConnection();
							this.set('uniqueId', _this.getUniqueId());
							this.set('timestamp', new Date());
							this.log({
							    sessionID: this.uniqueId,
							    type: 're.notifica.event.application.Open'
							});
							
						}.bind(this));

					});
				}

				 
			}else {
				this.debug('Notificare: Native notifications are not supported');
				
			}						
		}else{
			this.openConnection();
			this.set('uniqueId', this.getUniqueId());
			this.set('timestamp', new Date());
			this.log({
			    sessionID: this.uniqueId,
			    type: 're.notifica.event.application.Open'
			});
		}

		$(window).unload(function () {
			var d = new Date(), 
			end = d.getTime(), 
			start = d.getTime(), 
			length = end - start;
			this.log({
			    sessionID: this.uniqueId,
			    type: 're.notifica.event.application.Close',
			    data: {
			    	length: length
			    }
			});
		}.bind(this));
		
	},
	
	/**
	 * 
	 */
	reconnect: function() {
		this.reconnectTimeout = this.reconnectTimeout * 2;
		if (this.reconnectTimeout < this.config.minReconnectTimeout) {
			this.reconnectTimeout = this.config.minReconnectTimeout;
		} else if (this.reconnectTimeout > this.config.maxReconnectTimeout) {
			this.reconnectTimeout = this.config.maxReconnectTimeout;
		}
		this.debug('Reconnection in ' + this.reconnectTimeout + ' milliseconds');
		setTimeout(function() {
			this.start();
		}.bind(this), this.reconnectTimeout);
	},
	
	openConnection: function(){

		var d = new Date();
		
		if ("WebSocket" in window){

			var connection = new WebSocket( this.config.wss, this.config.protocols );
			
			//On OPEN
			connection.onopen = function () {
				this.debug('Notificare: On Open');
				if(this.getCookie('uuid')){
					connection.send(JSON.stringify({"command":"register", "uuid" : this.getCookie('uuid')}));
					this.setCookie('uuid', _this.getCookie('uuid'));
					this.set('deviceId', _this.getCookie('uuid'));
					this.debug('Notificare: returning browser');
				}else{
					connection.send(JSON.stringify({"command":"register"}));
					this.log({
						sessionID: this.uniqueId,
						type: 're.notifica.event.application.Install'
					});
					this.debug('Notificare: new browser');
				}
				
			}.bind(this);
			
			//On MESSAGE
			connection.onmessage = function (message) {
				this.debug('Notificare: on Message');
				if (message.data) {
					var data = JSON.parse(message.data);
					if (data.registration) {
						this.registerDevice({
							deviceID : data.registration.uuid,
							userID : null,
							userName : null,
							platform : this.config.clientInfo.getOS().name,
							osVersion : this.config.clientInfo.getOS().version,
							sdkVersion : this.config.sdk,
							appVersion : this.config.version,
							deviceString : window.navigator.platform, //to get better
							transport : 'Websocket',
							timeZoneOffset : (d.getTimezoneOffset()/60) * -1
						});
						this.setCookie('uuid', data.registration.uuid);
						this.set('deviceId', data.registration.uuid);
						this.debug('Notificare: Register Device' + data);
					} else if (data.notification) {
						this.getNotification(data.notification);
						this.debug('Notificare: got Notification' + data);
					}
				}
			}.bind(this);
			
			//On ERROR
			connection.onerror = function (e) {
				this.onError(e);
			}.bind(this);
				
			//On CLOSE
			connection.onclose = function (e) {
				this.onClose(e);
			}.bind(this);
			
		}else{

		}
	},
	
	/**
	 * 
	 * @returns
	 */
	getUniqueId: function() {
		return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	},
	/**
	 * 
	 */
	setCookie: function ( key, value ) {
		var expiration = new Date();
		expiration.setDate( expiration.getDate() + this.config.daysToExpire );
		var v = escape( value ) + ( ( this.config.daysToExpire == null ) ? "" : "; expires=" + expiration.toUTCString());
		document.cookie = key + "=" + v;
	},
	/**
	 * 
	 */
	getCookie: function ( key ) {
		var cookie = document.cookie;
		var cookieStart = cookie.indexOf( " " + key + "=" );
		if ( cookieStart == -1 ) {
			cookieStart = cookie.indexOf( key + "=" );
		}
		if ( cookieStart == -1 ) {
			cookie = null;
		} else {
			cookieStart = cookie.indexOf( "=", cookieStart ) + 1;
			var cookieEnd = cookie.indexOf( ";", cookieStart );
			if ( cookieEnd == -1 ) {
				cookieEnd = cookie.length;
			}
			cookie = unescape( cookie.substring( cookieStart, cookieEnd ) );
		}
		return cookie;
	},
	
	
	showNotification: function (msg) {

		if(this.config.native){
			this.notification = window.webkitNotifications.createNotification('/favicon.ico', this.config.name, msg.message);
			this.notification.ondisplay = function() {
				this.log({
				    sessionID: this.uniqueId,
				    type: 're.notifica.event.notification.Open',
				    notification: msg._id,
				    userID: this.userId,
				    deviceID: this.deviceId
				});
			}.bind(this);
			this.notification.onclose = function() {
				
			}.bind(this);
			this.notification.onclick = function() {
				
			}.bind(this);
			this.notification.show();						
		} else {
			this.set('notification', msg);
		}
	},
	
	registerDevice: function (device) {
		$.ajax({
			type: "POST",
			url: this.config.api + '/devices',
			data: device,
			dataType: 'json'
		}).done(function( msg ) {
			this.debug('Notificare: Device Registered');
		}.bind(this))
		.fail(function( msg ) {
			this.debug('Notificare: Failed to register device');
		}.bind(this));
	},
	/**
	 * 
	 */
	getNotification: function (notification) {
		$.ajax({
			type: "GET",
			url: this.config.api + '/notifications/' + notification.id,

		}).done(function( msg ) {
			this.showNotification(msg.notification);
		}.bind(this))
		.fail(function( msg ) {
			this.debug('Notificare: Failed to get notification');
		}.bind(this));
	},
	
	log: function (data) {
		$.ajax({
			type: "POST",
			url: this.config.api + '/events',
			data: data,
			dataType: 'json'
		}).done(function( msg ) {
			this.debug('Notificare: Log Registered');
		}.bind(this))
		.fail(function( msg ) {
			this.debug('Notificare: Failed to register log');
		}.bind(this));
	},
	
	getTags: function () {
		if (this.deviceId) {
			$.ajax({
				type: "GET",
				url: this.config.api + '/devices/' + this.deviceId + '/tags'
			}).done(function( msg ) {
				this.debug('Notificare: Tags' + msg);
			}.bind(this))
			.fail(function( msg ) {
				this.debug('Notificare: Failed to get tags' + msg);
			}.bind(this));
		} else {
			this.debug('Notificare: Calling get tags before having a deviceId');
		}
	},
	
	addTags: function (data) {
		if (this.deviceId) {
			$.ajax({
				type: "PUT",
				url: this.config.api + '/devices/' + this.deviceId + '/addtags',
				data: data,
				dataType: 'json'
			}).done(function( msg ) {
				this.debug('Notificare: Tag Registered' + msg);
			}.bind(this))
			.fail(function( msg ) {
				this.debug('Notificare: Failed to register tag' + msg);
			}.bind(this));
		} else {
			this.debug('Notificare: Calling add tags before having a deviceId');
		}
		
	},
	
	removeTag: function (data) {
		
		if (this.deviceId) {
			$.ajax({
				type: "PUT",
				url: this.config.api + '/events',
				data: {
					tag: data
				},
				dataType: 'json'
			}).done(function( msg ) {
				this.debug('Notificare: Tag removed' + data);
			}.bind(this))
			.fail(function( msg ) {
				this.debug('Notificare: Failed to remove tag');
			}.bind(this));
		} else {
			this.debug('Notificare: Calling remove tag before having a deviceId');
		}
		
	},
	
	reply: function (notification, data) {
		$.ajax({
			type: "POST",
			url: this.config.api + '/replies',
			data: {
				userID: this.userId,
				deviceID: this.deviceId,
				notification: notification,
				data: data
			},
			dataType: 'json'
		}).done(function( msg ) {
			this.debug('Notificare: Reply Registered');
		}.bind(this))
		.fail(function( msg ) {
			this.debug('Notificare: Failed to register reply');
		}.bind(this));
	},
	
	
	onError: function(e){
		this.debug('Notificare: Error connecting to Websockets' + e);
		this.reconnect();
	},
	
	onClose: function(e){
		this.debug('Notificare: Connection to Websockets closed' + e);
		this.reconnect();
	},
	
	debug: function(m){
		if(this.config.debug){
			console.log(m);
		}
	}
}); 
