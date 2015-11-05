/*
 *  Notificare JS for jQuery - v1.1.0
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
            sdkVersion: '1.6.0',
            apiUrl: "/api",
            websitePushUrl: "https://push.notifica.re/website-push/safari",
            wssUrl: "wss://websocket.notifica.re",
            protocols: ['notificare-push'],
            daysToExpire: '30',
            clientInfo: new UAParser(),
            userId: null,
            username: null
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

            this.placeholder = $(document.createElement('div'));
            this.placeholder.addClass('notificare');
            this.uniqueId = this.getUniqueID();
            this.sessionDate = new Date();
            this.reconnectTimeout = 0;
            this.minReconnectTimeout = 1000;
            this.maxReconnectTimeout = 60000;
            this.allowedNotifications = false;


            if(typeof(Storage) !== "undefined") {
                if(!localStorage.getItem("regions")){
                    localStorage.setItem("regions", JSON.stringify([]));
                }
            }

            var _this = this;

            this.logEvent({
                sessionID: this.uniqueId,
                type: 're.notifica.event.application.Open'
            }, function(data){

            }, function(error){

            });

            window.onbeforeunload = function() {

                var t2 = new Date(),
                    t1 = _this.sessionDate,
                    dif = t1.getTime() - t2.getTime(),
                    timedif = dif / 1000,
                    seconds = Math.abs(timedif);

                _this.logEvent({
                    sessionID: _this.uniqueId,
                    type: 're.notifica.event.application.Close',
                    data: {
                        length: seconds
                    }
                }, function(data){

                }, function(error){

                });

                return 'Leaving this page will prevent notifications from being received.';
            };

            // Safari Website Push
            if ('safari' in window && 'pushNotification' in window.safari && _this.options.pushId) {

                var data = window.safari.pushNotification.permission(_this.options.pushId);

                if (data.permission == 'default') {

                    window.safari.pushNotification.requestPermission( _this.options.websitePushUrl, _this.options.pushId, {applicationKey: _this.options.appKey}, function() {

                        if(data.deviceToken){
                            $(_this.element).trigger("notificare:didReceiveDeviceToken", data.deviceToken);
                            _this.allowedNotifications = true;
                            _this.logEvent({
                                sessionID: _this.uniqueId,
                                type: 're.notifica.event.application.Install'
                            },  function(data){

                            }, function(error){

                            });

                        } else {
                            if(this.options.allowSilent){
                                this.setSocket();
                            }
                        }

                    });
                } else if (data.permission == 'denied') {
                    if(this.options.allowSilent){
                        this.setSocket();
                    }
                } else if (data.permission == 'granted') {
                    _this.allowedNotifications = true;
                    $(_this.element).trigger("notificare:didReceiveDeviceToken", data.deviceToken);
                }

            } else {

                //Continue with Websockets

                //Modern browsers using window.Notification
                if (window.Notification) {

                    if (Notification.permission === 'default') {

                        Notification.requestPermission(function () {
                            _this.allowedNotifications = true;
                            _this.setSocket();
                        });


                    } else if (Notification.permission === 'granted') {
                        this.allowedNotifications = true;
                        this.setSocket();
                    } else if (Notification.permission === 'denied') {
                        if(this.options.allowSilent){
                            this.setSocket();
                        }
                    } else {
                        if(this.options.allowSilent){
                            this.setSocket();
                        }
                    }

                    //Legacy webkit browsers
                } else if (window.webkitNotifications) {

                    if (window.webkitNotifications.checkPermission() == 0) {
                        this.allowedNotifications = true;
                        this.setSocket();
                    } else {
                        window.webkitNotifications.requestPermission(function(e){

                            if(window.webkitNotifications.checkPermission() == 1){
                                if(_this.options.allowSilent){
                                    _this.setSocket();
                                }
                            } else if(window.webkitNotifications.checkPermission() == 2){
                                if(_this.options.allowSilent){
                                    _this.setSocket();
                                }
                            } else {
                                _this.allowedNotifications = true;
                                _this.setSocket();
                            }

                        });
                    }

                    //Legacy mozilla browsers
                } else if (navigator.mozNotification) {

                    if (navigator.mozNotification.checkPermission() == 0) {
                        this.allowedNotifications = true;
                        this.setSocket();
                    }else{
                        navigator.mozNotification.requestPermission(function(e){
                            if(navigator.mozNotification.checkPermission() == 1){
                                if(_this.options.allowSilent){
                                    _this.setSocket();
                                }
                            } else if(navigator.mozNotification.checkPermission() == 2){
                                if(_this.options.allowSilent){
                                    _this.setSocket();
                                }
                            } else {
                                _this.allowedNotifications = true;
                                _this.setSocket();
                            }
                        });
                    }
                } else {
                    if(this.options.allowSilent){
                        this.setSocket();
                    }
                }
            }


        },
        /**
         * Get/Set option key
         * @param key
         * @param val
         * @returns {*}
         */
        userId: function (val) {

            if (val) {
                this.options.userId = val;
            } else {
                return this.options.userId;
            }
        },
        username: function (val) {
            if (val) {
                this.options.username = val;
            } else {
                return this.options.username;
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
            var id = new Date().getTime();
            return id;
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
        reconnect: function() {
            this.reconnectTimeout = this.reconnectTimeout * 2;
            if (this.reconnectTimeout < this.minReconnectTimeout) {
                this.reconnectTimeout = this.minReconnectTimeout;
            } else if (this.reconnectTimeout > this.maxReconnectTimeout) {
                this.reconnectTimeout = this.maxReconnectTimeout;
            }
            this.log('Reconnection in ' + this.reconnectTimeout + ' milliseconds');

            var _this = this;
            setTimeout(function() {
                _this.setSocket();
            }, this.reconnectTimeout);
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
                    if(_this.getCookie('uuid')){
                        connection.send(JSON.stringify({"command":"register", "uuid" : _this.getCookie('uuid')}));
                    }else{
                        _this.logEvent({
                            sessionID: _this.uniqueId,
                            type: 're.notifica.event.application.Install'
                        },  function(data){

                        }, function(error){

                        });
                        connection.send(JSON.stringify({"command":"register"}));
                    }

                }

                //On MESSAGE
                connection.onmessage = function (message) {
                    if (message.data) {
                        var data = JSON.parse(message.data);
                        if (data.registration) {
                            $(_this.element).trigger("notificare:didReceiveDeviceToken", data.registration.uuid);
                        } else if (data.notification) {
                            _this.getNotification(data.notification);
                        }
                    }
                }

                //On ERROR
                connection.onerror = function (e) {
                    _this.reconnect();
                };

                //On CLOSE
                connection.onclose = function (e) {
                    _this.reconnect();
                };

            } else {
                this.log('Notificare: Browser doesn\'t support websockets');
            }

        },
        /**
         * API Requests
         */

        /**
         *
         * Register Device
         * @param uuid
         */
        registerDevice: function (uuid) {
            var d = new Date();
            var _this = this;

            _this.setCookie(uuid);

            $.ajax({
                type: "POST",
                url: this.options.apiUrl + '/devices',
                data: {
                    auth_token: this.options.token,
                    deviceID : uuid,
                    userID : (this.options.userId) ? this.options.userId : null,
                    userName : (this.options.username) ? this.options.username : null,
                    platform : this.options.clientInfo.getOS().name,
                    osVersion : this.options.clientInfo.getOS().version,
                    sdkVersion : this.options.sdkVersion,
                    appVersion : this.options.appVersion,
                    deviceString : window.navigator.platform, //to get better
                    transport : 'Websocket',
                    timeZoneOffset : (d.getTimezoneOffset()/60) * -1
                },
                dataType: 'json'
            }).done(function( msg ) {
                $(_this.element).trigger("notificare:didRegisterDevice", uuid);
            }).fail(function( msg ) {
                $(_this.element).trigger("notificare:didFailToRegisterDevice", uuid);
            });
        },
        /**
         * Get notification
         * @param notification
         */
        getNotification: function (notification) {

            this.logEvent({
                sessionID: this.uniqueId,
                type: 're.notifica.event.notification.Receive',
                notification: notification.id,
                userID: this.options.userId || null,
                deviceID: this.getCookie('uuid')
            },  function(data){

            }, function(error){

            });

            $(this.element).element.trigger("notificare:didReceiveNotification", notification);

            var _this = this;

            $.ajax({
                type: "GET",
                url: this.options.apiUrl + '/notifications/' + notification.id
            }).done(function( msg ) {
                if(_this.allowedNotifications){
                    _this.showNotification(msg);
                }
            }).fail(function( msg ) {
                _this.getNotification(notification);
            });

        },

        openNotification: function (notification) {

            var _this = this;

            $.ajax({
                type: "GET",
                url: this.options.apiUrl + '/notifications/' + notification.id
            }).done(function( msg ) {
                $(_this.element).element.trigger("notificare:didOpenNotification", msg.notification);
                _this.logEvent({
                    sessionID: _this.uniqueId,
                    type: 're.notifica.event.notification.Open',
                    notification: msg.notification.id,
                    userID: _this.options.userId || null,
                    deviceID: _this.getCookie('uuid')
                },  function(data){

                }, function(error){

                });
            }).fail(function( msg ) {
                _this.openNotification(notification);
            });

        },

        /**
         * Show notification
         * @param msg
         */
        showNotification: function (msg) {

            var _this = this;

            if ("Notification" in window) {
                var n = new Notification(
                    this.options.appName,
                    {
                        'body': msg.notification.message,
                        'tag': msg.notification.id,
                        'icon': '/favicon.ico'
                    }
                );
                // remove the notification from Notification Center when it is clicked
                n.onclick = function () {
                    $(_this.element).element.trigger("notificare:didOpenNotification", msg.notification);
                    _this._logNotificationEvents(msg);
                    this.close();
                };

            } else if ("webkitNotifications" in window) {
                var n = window.webkitNotifications.createNotification('/favicon.ico', this.options.appName, msg.notification.message);
                n.show();
                n.onclick = function () {
                    $(_this.element).element.trigger("notificare:didOpenNotification", msg.notification);
                    _this._logNotificationEvents(msg);
                };

            } else if ("mozNotification" in navigator) {
                var n = navigator.mozNotification.createNotification(this.options.appName, msg.notification.message, '/favicon.ico');
                n.show();
                n.onclick = function () {
                    $(_this.element).element.trigger("notificare:didOpenNotification", msg.notification);
                    _this._logNotificationEvents(msg);
                };
            }

        },

        /**
         * Log Notification Open events
         * @param msg
         */
        _logNotificationEvents: function(msg){
            this.logEvent({
                sessionID: this.uniqueId,
                type: 're.notifica.event.notification.Influenced',
                notification: msg.notification.id,
                userID: this.options.userId || null,
                deviceID: this.getCookie('uuid')
            },  function(data){

            }, function(error){

            });

            this.logEvent({
                sessionID: this.uniqueId,
                type: 're.notifica.event.notification.Open',
                notification: msg.notification.id,
                userID: this.options.userId || null,
                deviceID: this.getCookie('uuid')
            },  function(data){

            }, function(error){

            });
        },

        /**
         * Log an event
         * @param data
         * @param success
         * @param errors
         */
        logEvent: function (data, success, errors) {
            $.ajax({
                type: "POST",
                url: this.options.apiUrl + '/events',
                data: data,
                dataType: 'json'
            }).done(function( msg ) {
                success(msg);
            }.bind(this))
            .fail(function( msg ) {
                errors('Notificare: Failed to register log');
            }.bind(this));
        },
        /**
         * Get tags for a device
         * @param success
         * @param errors
         */
        getTags: function (success, errors) {
            if (this.getCookie('uuid')) {
                $.ajax({
                    type: "GET",
                    url: this.options.apiUrl + '/devices/' + this.getCookie('uuid') + '/tags'
                }).done(function( msg ) {
                    success(msg.tags);
                }.bind(this))
                .fail(function( msg ) {
                    errors("Notificare: Failed to get tags for device");
                }.bind(this));
            } else {
                errors('Notificare: Calling get tags before having a deviceId');
            }
        },
        /**
         * Add tags to a device
         * @param data
         * @param success
         * @param errors
         */
        addTags: function (data, success, errors) {
            if (this.getCookie('uuid')) {
                $.ajax({
                    type: "PUT",
                    url: this.options.apiUrl + '/devices/' + this.getCookie('uuid') + '/addtags',
                    data: {
                        tags: data
                    },
                    dataType: 'json'
                }).done(function( msg ) {
                    success(msg);
                }.bind(this))
                .fail(function( msg ) {
                    errors("Notificare: Failed to add tags to device");
                }.bind(this));
            } else {
                errors("Notificare: Calling addTags before registering a deviceId");
            }
        },
        /**
         * Remove tags for a device
         * @param data
         * @param success
         * @param errors
         */
        removeTag: function (data, success, errors) {

            if (this.getCookie('uuid')) {
                $.ajax({
                    type: "PUT",
                    url: this.options.apiUrl + '/devices/' + this.getCookie('uuid') + '/removetag',
                    data: {
                        tag: data
                    },
                    dataType: 'json'
                }).done(function( msg ) {
                    success(msg);
                }.bind(this))
                .fail(function( msg ) {
                    errors(null);
                }.bind(this));
            } else {
                errors("Notificare: Calling removeTag before registering a deviceId");
            }
        },
        /**
         * Clear all device tags
         * @param success
         * @param errors
         */
        clearTags: function (success, errors) {

            if (this.getCookie('uuid')) {
                $.ajax({
                    type: "PUT",
                    url: this.options.apiUrl + '/devices/' + this.getCookie('uuid') + '/cleartags',
                    data: null,
                    dataType: 'json'
                }).done(function( msg ) {
                    success(msg);
                }.bind(this))
                .fail(function( msg ) {
                    errors("Failed to clear device tags.");
                }.bind(this));
            } else {
                errors("Notificare: Calling clearTags before registering a deviceId");
            }
        },

        /**
         * Start Location Updates
         */
        startLocationUpdates: function (success, errors) {

            var _this = this;

            if (this.getCookie('uuid')) {

                if (navigator.geolocation) {
                    navigator.geolocation.watchPosition(function(position){

                        _this._getDeviceCountry(position, function(data){
                            _this.updateLocation(position, data.country, function(data){

                                _this._getNearestRegions(position, function(regions){
                                    _this._handleRegions(position, regions);
                                    success(data);
                                }, function(errors){

                                });


                            }, function(){
                                errors("Notificare: Failed to update device location");
                            });
                        });


                    }, function(error){
                        switch(error.code) {
                            case error.PERMISSION_DENIED:
                                errors("Notificare: User denied the request for Geolocation");
                                break;
                            case error.POSITION_UNAVAILABLE:
                                errors("Notificare: Location information is unavailable");
                                break;
                            case error.TIMEOUT:
                                errors("Notificare: The request to get user location timed out");
                                break;
                            case error.UNKNOWN_ERROR:
                                errors("Notificare: An unknown location error occurred");
                                break;
                        }
                    }, this.options.geolocationOptions);
                } else {
                    errors("Notificare: Browser does not support Geolocation API");
                }

            } else {
                errors("Notificare: Calling startLocationUpdates before registering a deviceId");
            }
        },

        /**
         * Stop location updates
         */
        stopLocationUpdates: function(){
            if (navigator.geolocation) {
                navigator.geolocation.clearWatch();
            }
        },

        /**
         * Update device location
         * @param position
         * @param country
         * @param callback
         */
        updateLocation: function(position, country, success, errors){

            $.ajax({
                type: "PUT",
                url: this.options.apiUrl + '/devices/' + this.getCookie('uuid'),
                data: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    country: country
                },
                dataType: 'json'
            }).done(function( msg ) {
                success({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    country: country
                });
            }.bind(this))
            .fail(function( msg ) {
                errors(null);
            }.bind(this));

        },

        _handleRegions: function(position, regions){

            var _this = this;
            $.each( regions, function( index, region ){
                var localRegions = JSON.parse(localStorage.getItem("regions"));
                if(_this._calculateDistanceBetweenPoints(position, region) <= region.distance){

                    if($.inArray(region._id, localRegions) == -1){
                        _this._trigger("re.notifica.trigger.region.Enter", region, function(data){
                            localRegions.push(region._id);
                            localStorage.setItem("regions", JSON.stringify(localRegions));
                        }, function(errors){

                        });
                    }
                } else {

                    var i = $.inArray(region._id, localRegions);
                    if(i > -1){
                        _this._trigger("re.notifica.trigger.region.Exit", region, function(data){
                            localRegions.splice(i, 1);
                            localStorage.setItem("regions", JSON.stringify(localRegions));
                        }, function(errors){

                        });
                    }
                }
            });

        },
        /**
         * Get nearest regions
         * @param position
         * @param success
         * @param errors
         * @private
         */
        _getNearestRegions: function(position, success, errors){

            $.ajax({
                type: "GET",
                url: this.options.apiUrl + '/regions/bylocation/' + position.coords.latitude + '/' + position.coords.longitude,
                data: null
            }).done(function( msg ) {
                success(msg.regions);
            }.bind(this))
            .fail(function( msg ) {
                errors('Notificare: Failed to retrieve nearest regions');
            }.bind(this));

        },

        /**
         * Calculate distance between 2 points
         * @param position
         * @param region
         * @returns {number}
         * @private
         */
        _calculateDistanceBetweenPoints: function(position, region){

            var lat1 = position.coords.latitude;
            var lat2 = region.geometry.coordinates[1];
            var lon1 = position.coords.longitude;
            var lon2 = region.geometry.coordinates[0];
            var R = 6371000; // metres
            var _r1 = lat1 * Math.PI / 180;
            var _r2 = lat2 * Math.PI / 180;
            var _a1 = (lat2-lat1) * Math.PI / 180;
            var _a2 = (lon2-lon1) * Math.PI / 180;

            var a = Math.sin(_a1/2) * Math.sin(_a1/2) +
                Math.cos(_r1) * Math.cos(_r2) *
                Math.sin(_a2/2) * Math.sin(_a2/2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

            var d = R * c;

            return d;

        },

        /**
         * Get a device country by lat and lng
         * @param position
         * @param callback
         */
        _getDeviceCountry: function(position, callback){

            $.ajax({
                type: "GET",
                url: 'http://maps.googleapis.com/maps/api/geocode/json',
                data: {
                    latlng: position.coords.latitude + ',' + position.coords.longitude,
                    sensor: false
                }
            }).done(function( msg ) {

                if(msg.status === 'OK' && msg.results && msg.results.length > 0){

                    callback({
                        country: msg.results[msg.results.length - 1].address_components[0].short_name
                    });
                } else {
                    callback({
                        country: null
                    });
                }

            }.bind(this))
            .fail(function( msg ) {
                callback({
                    country: null
                });
            }.bind(this));

        },
        /**
         * Register a reply
         * @param notification
         * @param data
         */
        reply: function (notification, data, success, errors) {

            if (this.getCookie('uuid')) {
                $.ajax({
                    type: "POST",
                    url: this.options.apiUrl + '/replies',
                    data: {
                        userID: this.options.userId,
                        deviceID: this.getCookie('uuid'),
                        notification: notification,
                        data: data
                    },
                    dataType: 'json'
                }).done(function (msg) {
                    success(msg);
                }.bind(this))
                .fail(function (msg) {
                    errors('Notificare: Failed to register reply');
                }.bind(this));
            } else {
                errors("Notificare: Calling reply before registering a deviceId");
            }
        },

        _trigger: function (type, region, success, errors) {

            $.ajax({
                type: "POST",
                url: this.options.apiUrl + '/triggers/' + type,
                data: {
                    region: region._id,
                    deviceID: this.getCookie('uuid')
                },
                dataType: 'json'
            }).done(function (msg) {
                success(msg);
            }.bind(this))
            .fail(function (msg) {
                errors('Notificare: Failed to trigger region');
            }.bind(this));

        }
    };

    // A really lightweight plugin wrapper around the constructor,
    // preventing against multiple instantiations
    $.fn[ pluginName ] = function ( options ) {

        // If the first parameter is a string, treat this as a call to
        // a public method.
        if (typeof arguments[0] === 'string') {
            var methodName = arguments[0];
            var args = Array.prototype.slice.call(arguments, 1);
            var returnVal;
            this.each(function() {
                // Check that the element has a plugin instance, and that
                // the requested public method exists.

                if ($.data(this, pluginName) && typeof $.data(this, pluginName)[methodName] === 'function') {
                    // Call the method of the Plugin instance, and Pass it
                    // the supplied arguments.

                    var plugin =  $.data(this, pluginName);
                    returnVal = plugin[methodName].apply(plugin, args);

                } else {
                    throw new Error('Method ' +  methodName + ' does not exist on ' + pluginName + '.jquery.js');
                }
            });
            if (returnVal !== undefined){
                // If the method returned a value, return the value.
                return returnVal;
            } else {
                // Otherwise, returning 'this' preserves chainability.
                return this;
            }
            // If the first parameter is an object (options), or was omitted,
            // instantiate a new instance of the plugin.
        } else if (typeof options === "object" || !options) {
            return this.each(function() {
                if ( !$.data( this, pluginName ) ) {
                    $.data( this, pluginName, new Plugin( this, options ) );
                }
            });
        }

    };

})( jQuery, window, document );