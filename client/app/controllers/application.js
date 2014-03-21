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
		debug: false
	},
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
							_this.debug('Notificare: Accepted');
							_this.openConnection();
							_this.set('uniqueId', _this.getUniqueId());
							_this.set('timestamp', new Date());
							_this.log({
							    sessionID: this.uniqueId,
							    type: 're.notifica.event.application.Open'
							});
							
						});

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
	
	openConnection: function(){
		var _this = this;
		var d = new Date();
		
		if ("WebSocket" in window){

			var connection = new WebSocket( this.config.wss, this.config.protocols );
			
			//On OPEN
			connection.onopen = function () {
				_this.debug('Notificare: On Open');
				if(_this.getCookie('uuid')){
					connection.send(JSON.stringify({"command":"register", "uuid" : _this.getCookie('uuid')}));
					_this.setCookie('uuid', _this.getCookie('uuid'));
					_this.set('deviceId', _this.getCookie('uuid'));
					_this.debug('Notificare: returning browser');
				}else{
					connection.send(JSON.stringify({"command":"register"}));
					_this.log({
						sessionID: this.uniqueId,
						type: 're.notifica.event.application.Install'
					});
					_this.debug('Notificare: new browser');
				}
				
			}
			
			//On MESSAGE
			connection.onmessage = function (message) {
				_this.debug('Notificare: on Message');
				if (message.data) {
					var data = JSON.parse(message.data);
					if (data.registration) {
						_this.registerDevice({
							deviceID : data.registration.uuid,
							userID : null,
							userName : null,
							platform : _this.config.clientInfo.getOS().name,
							osVersion : _this.config.clientInfo.getOS().version,
							sdkVersion : _this.config.sdk,
							appVersion : _this.config.version,
							deviceString : window.navigator.platform, //to get better
							transport : 'Websocket',
							timeZoneOffset : (d.getTimezoneOffset()/60) * -1
						});
						_this.setCookie('uuid', data.registration.uuid);
						_this.set('deviceId', data.registration.uuid);
						_this.debug('Notificare: Register Device' + data);
					} else if (data.notification) {
						_this.getNotification(data.notification);
						_this.debug('Notificare: got Notification' + data);
					}
				}
			}
			
			//On ERROR
			connection.onerror = function (e) {
				_this.onError(e);
			};
				
			//On CLOSE
			connection.onclose = function (e) {
				_this.onClose(e);
			};
			
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
			var _this = this;
			this.notification.ondisplay = function() {
				_this.log({
				    sessionID: _this.uniqueId,
				    type: 're.notifica.event.notification.Open',
				    notification: msg._id,
				    userID: _this.userId,
				    deviceID: _this.deviceId
				});
			};
			this.notification.onclose = function() {
				
			};
			this.notification.onclick = function() {
				
			};
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
		this.start();
	},
	
	onClose: function(e){
		this.debug('Notificare: Connection to Websockets closed' + e);
		this.start();
	},
	
	debug: function(m){
		if(this.config.debug){
			console.log(m);
		}
	}
}); 
