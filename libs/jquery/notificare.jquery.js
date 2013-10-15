/*
 *  Notificare JS for jQuery - v0.0.1
 *  jQuery Library for Notificare
 *  http://notifica.re
 *
 *  @author Joel Oliveira joel@notifica.re
 *  copyright 2013 Notificare
 */

;(function ( $, window, document, undefined ) {

		// Create the defaults once
		var pluginName = "notificare",
				defaults = {
				sdkVersion: '0.0.1',
				apiUrl: "https://push.notifica.re",
				wssUrl: "wss://websocket.notifica.re",
				protocols: ['notificare-push'],
				daysToExpire: '30',
				clientInfo: new UAParser()
		};

		// The actual plugin constructor
		function Plugin ( element, options ) {
				this.element = element;
				this.options = $.extend( {}, defaults, options );
				this._defaults = defaults;
				this._name = pluginName;
				this.init();
		}

		Plugin.prototype = {
				/**
				 * 
				 */
				init: function () {
					
					//Some checking
					if(this.options.development){
						if(!this.options.keys.development.applicationKey || !this.options.keys.development.applicationSecret){
							alert('Please check your configuration. The provided keys seems to be invalid.');
							return;
						}	
						this.options.authHeader = Base64.encode(this.options.keys.development.applicationKey + ':' + this.options.keys.development.applicationSecret);
					}else{
						if(!this.options.keys.production.applicationKey || !this.options.keys.production.applicationSecret){
							alert('Please check your configuration. The provided keys are invalid.');
							return;
						}						
						this.options.authHeader = Base64.encode(this.options.keys.production.applicationKey + ':' + this.options.keys.production.applicationSecret);
					}
					
					this.placeholder = $(document.createElement('div'));
					this.placeholder.addClass('notificare');
					this.log('Notificare: Using Development Keys');
					
					if(this.options.nativeNotifications){
						if (window.webkitNotifications) {
							this.log('Notificare: Native notifications are supported');
							
							 if (window.webkitNotifications.checkPermission() == 0) {
								this.setSocket();
							}else{
								var a = $(document.createElement('a'));
								a.attr("href", "#")
								a.text('Authorize Notifications');							
								$(this.element).prepend(a);
								var _this = this;
								a.click(function(e) {
									e.preventDefault();
									window.webkitNotifications.requestPermission(function(e){
										a.remove();
										_this.setSocket();
									});

								});
							}

							 
						}else {
							this.log('Notificare: Native notifications are not supported');
						}						
					}else{
						this.setSocket();
					}

					
				},
				/**
				 * 
				 */
				log: function(m) {
					if(this.options.development){
						console.log(m);
					}
				},
				/**
				 * 
				 */
				getUniqueID: function() {
					return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
				},
				/**
				 * 
				 */
				setCookie: function ( id ) {
					var expiration = new Date();
					expiration.setDate( expiration.getDate() + this.options.daysToExpire );
					var value = escape( id ) + ( ( this.options.daysToExpire == null ) ? "" : "; expires=" + expiration.toUTCString());
					document.cookie = 'uuid' + "=" + value;
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
				/**
				 * 
				 */
				setSocket: function () {
					
					var _this = this;
					
					if ("WebSocket" in window){

						var connection = new WebSocket( this.options.wssUrl, this.options.protocols );
						
						//On OPEN
						connection.onopen = function () {
							$(_this.element).trigger("notificare:didConnectToWebSocket");
							if(_this.getCookie('uuid')){
								connection.send(JSON.stringify({"command":"register", "uuid" : _this.getCookie('uuid')}));
							}else{
								connection.send(JSON.stringify({"command":"register"}));
							}
							
						}
						
						//On MESSAGE
						connection.onmessage = function (message) {
							if (message.data) {
								var data = JSON.parse(message.data);
								if (data.registration) {
									$(_this.element).trigger("notificare:didRegisterWebSocket", data.registration.uuid);
									_this.registerDevice(data.registration.uuid);
									_this.setCookie(data.registration.uuid);
								} else if (data.notification) {
									_this.getNotification(data.notification.id);
								}
							}
						}
						
						//On ERROR
						connection.onerror = function (e) {
							$(_this.element).trigger("notificare:didGetErrorWebSocket");
						}
							
						//On CLOSE
						connection.onclose = function (e) {
							$(_this.element).trigger("notificare:didCloseWebSocket");
						}
						
					}else{
						this.log('Notificare: Browser doesn\'t support websockets');
					}

				},
				/**
				 * 
				 */
				registerDevice: function (uuid) {
					var d = new Date();
					var _this = this;
					$.ajax({
						type: "POST",
						url: this.options.apiUrl + '/device',
						data: {
							deviceID : uuid,
							userID : (this.options.userID) ? this.options.userID : null,
							userName : (this.options.username) ? this.options.username : null,
							platform : this.options.clientInfo.getOS().name,
							osVersion : this.options.clientInfo.getOS().version,
							sdkVersion : this.options.sdkVersion,
							appVersion : this.options.appVersion,
							deviceString : window.navigator.platform, //to get better
							transport : 'Websocket',
							timeZoneOffset : (d.getTimezoneOffset()/60) * -1
						},
						dataType: 'json',
						//contentType: 'application/json',
						beforeSend: function (xhr) { 
							xhr.setRequestHeader('Authorization', 'Basic ' + _this.options.authHeader); 
						}
					}).done(function( msg ) {
						_this.log('Notificare: Device Registered');
					}).fail(function( msg ) {
						_this.log('Notificare: Failed to register device');
					});
				},
				/**
				 * 
				 */
				getNotification: function (id) {
					$(this.element).trigger("notificare:willOpenNotification", id);
					var _this = this;
					$.ajax({
						type: "GET",
						url: this.options.apiUrl + '/notification/' + id,
						dataType: 'json',
						//contentType: 'application/json',
						beforeSend: function (xhr) { 
							xhr.setRequestHeader('Authorization', 'Basic ' + _this.options.authHeader); 
						}
					}).done(function( msg ) {
						_this.showNotification( msg );
					}).fail(function( msg ) {
						$(_this.element).element.trigger("notificare:didFailToOpenNotification", msg);
						_this.log('Notificare: Failed to open notification');
					});
				},
				/**
				 * 
				 */
				showNotification: function (msg) {
					$(this.element).trigger("notificare:didOpenNotification", msg.notification);
					
					if(this.options.nativeNotifications){
						this.notification = window.webkitNotifications.createNotification('/favicon.ico', this.options.appName, msg.notification.message);
						this.notification.ondisplay = function() {
							
						};
						this.notification.onclose = function() {
							
						};
						this.notification.show();						
					}
					
				}
		};

		// A really lightweight plugin wrapper around the constructor,
		// preventing against multiple instantiations
		$.fn[ pluginName ] = function ( options ) {
				return this.each(function() {
						if ( !$.data( this, pluginName ) ) {
								$.data( this, pluginName, new Plugin( this, options ) );
						}
				});
		};

})( jQuery, window, document );