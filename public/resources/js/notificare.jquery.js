/*
 *  Notificare JS for jQuery - v1.6.0
 *  jQuery Library for Notificare
 *  http://notifica.re
 *
 *  @author Joel Oliveira joel@notifica.re
 *  copyright 2015 Notificare
 */

;(function ( $, window, document, undefined ) {

    // Create the defaults once
    var pluginName = "notificare",
        defaults = {
            sdkVersion: '1.6.0',
            apiUrl: "https://cloud.notifica.re/api",
            websitePushUrl: "https://push.notifica.re/website-push/safari",
            awsStorage: 'https://s3-eu-west-1.amazonaws.com/notificare-storage',
            fullHost: window.location.protocol + '//' +  window.location.host,
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
            this.uniqueId = this._getUniqueID();
            this.sessionDate = new Date();
            this.reconnectTimeout = 0;
            this.minReconnectTimeout = 1000;
            this.maxReconnectTimeout = 60000;
            this.allowedNotifications = false;
            this.safariPush = false;

            if(typeof(Storage) !== "undefined") {
                if(!localStorage.getItem("regions")){
                    localStorage.setItem("regions", JSON.stringify([]));
                }

                if(!localStorage.getItem("position")){
                    localStorage.setItem("position", JSON.stringify({
                        latitude: 0.0,
                        longitude: 0.0,
                    }));
                }
            }

            this._getApplicationInfo();


            $(window).bind("focus",function(event){

                this.sessionDate = new Date();
                this.logEvent({
                    sessionID: this.uniqueId,
                    type: 're.notifica.event.application.Open'
                }, function(data){

                }, function(error){

                });

            }.bind(this)).bind("blur", function(event){
                var t2 = new Date(),
                    t1 = this.sessionDate,
                    dif = t1.getTime() - t2.getTime(),
                    timedif = dif / 1000,
                    seconds = Math.abs(timedif);

                this.logEvent({
                    sessionID: this.uniqueId,
                    type: 're.notifica.event.application.Close',
                    data: {
                        length: seconds
                    }
                }, function(data){
                    console.log("Notificare: Session:" + seconds + " seconds");
                }, function(error){

                });
            }.bind(this));

        },

        registerForNotifications: function(){

            if(this.applicationInfo.websitePushConfig &&
                this.applicationInfo.websitePushConfig.icon &&
                this.applicationInfo.websitePushConfig.allowedDomains.length > 0 &&
                $.inArray(this.options.fullHost, this.applicationInfo.websitePushConfig.allowedDomains) > -1){

                // Safari Website Push
                if ('safari' in window &&
                    'pushNotification' in window.safari &&
                    this.applicationInfo.websitePushConfig &&
                    this.applicationInfo.websitePushConfig.info &&
                    this.applicationInfo.websitePushConfig.info.subject &&
                    this.applicationInfo.websitePushConfig.info.subject.UID) {

                    var data = window.safari.pushNotification.permission(this.applicationInfo.websitePushConfig.info.subject.UID);

                    if (data.permission == 'default') {

                        window.safari.pushNotification.requestPermission( this.options.websitePushUrl, this.applicationInfo.websitePushConfig.info.subject.UID, {applicationKey: this.options.appKey}, function(permission) {

                            if(permission.deviceToken){

                                this.allowedNotifications = true;
                                this.safariPush = true;
                                $(this.element).trigger("notificare:didReceiveDeviceToken", permission.deviceToken);
                                this.logEvent({
                                    sessionID: this.uniqueId,
                                    type: 're.notifica.event.application.Install'
                                },  function(data){

                                }, function(error){

                                });

                            }

                        }.bind(this));
                    } else if (data.permission == 'denied') {
                        if(this.options.allowSilent){
                            this._setSocket();
                        }
                    } else if (data.permission == 'granted') {
                        this.allowedNotifications = true;
                        this.safariPush = true;
                        $(this.element).trigger("notificare:didReceiveDeviceToken", data.deviceToken);
                    }

                } else {

                    //Continue with Websockets

                    //Modern browsers using window.Notification
                    if (window.Notification) {

                        if (Notification.permission === 'default') {

                            Notification.requestPermission(function () {
                                this.allowedNotifications = true;
                                this._setSocket();
                            }.bind(this));


                        } else if (Notification.permission === 'granted') {
                            this.allowedNotifications = true;
                            this._setSocket();
                        } else if (Notification.permission === 'denied') {
                            if(this.options.allowSilent){
                                this._setSocket();
                            }
                        } else {
                            if(this.options.allowSilent){
                                this._setSocket();
                            }
                        }

                        //Legacy webkit browsers
                    } else if (window.webkitNotifications) {

                        if (window.webkitNotifications.checkPermission() == 0) {
                            this.allowedNotifications = true;
                            this._setSocket();
                        } else {
                            window.webkitNotifications.requestPermission(function(e){

                                if(window.webkitNotifications.checkPermission() == 1){
                                    if(this.options.allowSilent){
                                        this._setSocket();
                                    }
                                } else if(window.webkitNotifications.checkPermission() == 2){
                                    if(this.options.allowSilent){
                                        this._setSocket();
                                    }
                                } else {
                                    this.allowedNotifications = true;
                                    this._setSocket();
                                }

                            }.bind(this));
                        }

                        //Legacy mozilla browsers
                    } else if (navigator.mozNotification) {

                        if (navigator.mozNotification.checkPermission() == 0) {
                            this.allowedNotifications = true;
                            this._setSocket();
                        }else{
                            navigator.mozNotification.requestPermission(function(e){
                                if(navigator.mozNotification.checkPermission() == 1){
                                    if(this.options.allowSilent){
                                        this._setSocket();
                                    }
                                } else if(navigator.mozNotification.checkPermission() == 2){
                                    if(this.options.allowSilent){
                                        this._setSocket();
                                    }
                                } else {
                                    this.allowedNotifications = true;
                                    this._setSocket();
                                }
                            }.bind(this));
                        }
                    } else {
                        if(this.options.allowSilent){
                            this._setSocket();
                        }
                    }
                }

            } else {
                this.log("Notificare: Please check your Website Push configurations in our dashboard before proceed");
            }

        },
        /**
         * Get/Set userId
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
        /**
         * Get/Set username
         * @param key
         * @param val
         * @returns {*}
         */
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
            console.log(m);
        },
        /**
         *
         */
        _getUniqueID: function() {
            var id = new Date().getTime();
            return id;
        },
        /**
         *
         */
        _setCookie: function ( id ) {
            var expiration = new Date();
            expiration.setDate( expiration.getDate() + this.options.daysToExpire );
            var value = escape( id ) + ( ( this.options.daysToExpire == null ) ? "" : "; expires=" + expiration.toUTCString());
            document.cookie = 'uuid' + "=" + value;
        },
        /**
         *
         */
        _getCookie: function ( key ) {
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
         * Reconnect Websockets
         * @private
         */
        _reconnect: function() {
            this.reconnectTimeout = this.reconnectTimeout * 2;
            if (this.reconnectTimeout < this.minReconnectTimeout) {
                this.reconnectTimeout = this.minReconnectTimeout;
            } else if (this.reconnectTimeout > this.maxReconnectTimeout) {
                this.reconnectTimeout = this.maxReconnectTimeout;
            }
            this.log('Reconnection in ' + this.reconnectTimeout + ' milliseconds');

            setTimeout(function() {
                this._setSocket();
            }.bind(this), this.reconnectTimeout);
        },
        /**
         * Manage websockets connections
         * @private
         */
        _setSocket: function () {

            if ("WebSocket" in window){

                var connection = new WebSocket( this.options.wssUrl, this.options.protocols );

                //On OPEN
                connection.onopen = function () {
                    if(this._getCookie('uuid')){
                        connection.send(JSON.stringify({"command":"register", "uuid" : this._getCookie('uuid')}));
                    }else{
                        this.logEvent({
                            sessionID: this.uniqueId,
                            type: 're.notifica.event.application.Install'
                        },  function(data){

                        }, function(error){

                        });
                        connection.send(JSON.stringify({"command":"register"}));
                    }

                }.bind(this);

                //On MESSAGE
                connection.onmessage = function (message) {
                    if (message.data) {
                        var data = JSON.parse(message.data);
                        if (data.registration) {
                            $(this.element).trigger("notificare:didReceiveDeviceToken", data.registration.uuid);
                        } else if (data.notification) {
                            this._getNotification(data.notification);
                        }
                    }
                }.bind(this);

                //On ERROR
                connection.onerror = function (e) {
                    this._reconnect();
                }.bind(this);

                //On CLOSE
                connection.onclose = function (e) {
                    this._reconnect();
                }.bind(this);

            } else {
                this.log('Notificare: Browser doesn\'t support websockets');
            }

        },
        /**
         * API Requests
         */

        /**
         * Get Application Info
         * @private
         */
        _getApplicationInfo: function () {

            $.ajax({
                type: "GET",
                url: this.options.apiUrl + '/application/info',
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                }.bind(this)
            }).done(function( msg ) {
                this.applicationInfo = msg.application;
                $(this.element).trigger("notificare:onReady", msg.application);

                this.logEvent({
                    sessionID: this.uniqueId,
                    type: 're.notifica.event.application.Open'
                }, function(data){

                }, function(error){

                });


                this._onURLLocationChanged();

            }.bind(this)).fail(function( msg ) {
                setTimeout(function() {
                    this._getApplicationInfo();
                }.bind(this), 2000);
            }.bind(this));

        },
        /**
         *
         * Register Device
         * @param uuid
         */
        registerDevice: function (uuid) {
            var d = new Date();

            this._setCookie(uuid);

            $.ajax({
                type: "POST",
                url: this.options.apiUrl + '/device',
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                }.bind(this),
                data: {
                    auth_token: this.options.token,
                    deviceID : uuid,
                    userID : (this.options.userId) ? this.options.userId : null,
                    userName : (this.options.username) ? this.options.username : null,
                    platform : (this.safariPush) ? 'Safari' : this.options.clientInfo.getOS().name,
                    osVersion : this.options.clientInfo.getOS().version,
                    sdkVersion : this.options.sdkVersion,
                    appVersion : this.options.appVersion,
                    deviceString : window.navigator.platform, //to get better
                    transport : (this.safariPush) ? 'WebsitePush' : 'Websocket',
                    timeZoneOffset : (d.getTimezoneOffset()/60) * -1
                },
                dataType: 'json'
            }).done(function( msg ) {
                $(this.element).trigger("notificare:didRegisterDevice", uuid);
            }.bind(this)).fail(function( msg ) {
                $(this.element).trigger("notificare:didFailToRegisterDevice", uuid);
            }.bind(this));
        },
        /**
         * Get a notification object
         * @param notification
         * @private
         */
        _getNotification: function (notification) {

            this.logEvent({
                sessionID: this.uniqueId,
                type: 're.notifica.event.notification.Receive',
                notification: notification.id,
                userID: this.options.userId || null,
                deviceID: this._getCookie('uuid')
            },  function(data){

            }, function(error){

            });

            $(this.element).trigger("notificare:didReceiveNotification", notification);

            $.ajax({
                type: "GET",
                url: this.options.apiUrl + '/notification/' + notification.id,
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                }.bind(this)
            }).done(function( msg ) {
                if(this.allowedNotifications){

                    if(this.options.soundsDir && notification.sound){
                        var audio = new Audio(this.options.soundsDir + notification.sound);
                        audio.load();
                        audio.play();
                    }

                    this.showNotification(msg);
                }
            }.bind(this)).fail(function( msg ) {
                setTimeout(function() {
                    this._getNotification(notification);
                }.bind(this), 2000);
            }.bind(this));

        },

        /**
         * Open Notification
         * @param notification
         */
        openNotification: function (notification) {

            $.ajax({
                type: "GET",
                url: this.options.apiUrl + '/notification/' + notification.id,
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                }.bind(this)
            }).done(function( msg ) {
                $(this.element).trigger("notificare:didOpenNotification", msg.notification);
                this._logNotificationEvents(msg);
            }.bind(this)).fail(function( msg ) {
                setTimeout(function() {
                    this.openNotification(notification);
                }.bind(this), 2000);
            }.bind(this));

        },

        /**
         * Show notification
         * @param msg
         */
        showNotification: function (msg) {

            if ("Notification" in window) {

                var n = new Notification(
                    this.applicationInfo.name,
                    {
                        'body': msg.notification.message,
                        'tag': msg.notification._id,
                        'icon': this.options.awsStorage + this.applicationInfo.websitePushConfig.icon
                    }
                );
                // remove the notification from Notification Center when it is clicked
                n.onclick = function () {
                    n.close();
                    var url = this.applicationInfo.websitePushConfig.urlFormatString.replace("%@", msg.notification._id);
                    window.location.replace(url);
                    this._onURLLocationChanged();

                }.bind(this);

            } else if ("webkitNotifications" in window) {
                var n = window.webkitNotifications.createNotification(this.options.awsStorage + this.applicationInfo.websitePushConfig.icon, this.applicationInfo.name, msg.notification.message);
                n.show();
                n.onclick = function () {

                    var url = this.applicationInfo.websitePushConfig.urlFormatString.replace("%@", msg.notification._id);
                    window.location.replace(url);
                    this._onURLLocationChanged();

                }.bind(this);

            } else if ("mozNotification" in navigator) {
                var n = navigator.mozNotification.createNotification(this.applicationInfo.name, msg.notification.message, this.options.awsStorage + this.applicationInfo.websitePushConfig.icon);
                n.show();
                n.onclick = function () {

                    var url = this.applicationInfo.websitePushConfig.urlFormatString.replace("%@", msg.notification._id);
                    window.location.replace(url);
                    this._onURLLocationChanged();

                }.bind(this);
            }

        },

        /**
         * Load Notification on URLLocationChanged
         * @private
         */
        _onURLLocationChanged: function(){
            if(this.applicationInfo && this.applicationInfo.websitePushConfig && this.applicationInfo.websitePushConfig.urlFormatString){
                var re = new RegExp(this.applicationInfo.websitePushConfig.urlFormatString.replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1").replace('%@','(\\w+)'));
                var comps = re.exec(window.location);

                if(comps && comps.length > 1){
                    this.openNotification({id: comps[1]});
                }
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
                notification: msg.notification._id,
                userID: this.options.userId || null,
                deviceID: this._getCookie('uuid')
            },  function(data){

            }, function(error){

            });

            this.logEvent({
                sessionID: this.uniqueId,
                type: 're.notifica.event.notification.Open',
                notification: msg.notification._id,
                userID: this.options.userId || null,
                deviceID: this._getCookie('uuid')
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
                url: this.options.apiUrl + '/event',
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                }.bind(this),
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
         * Log a custom event
         * @param event
         * @param success
         * @param errors
         */
        logCustomEvent: function (event, success, errors) {
            $.ajax({
                type: "POST",
                url: this.options.apiUrl + '/event',
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                }.bind(this),
                data: {
                    sessionID: this.uniqueId,
                    type: 're.notifica.event.custom.' + event,
                    userID: this.options.userId || null,
                    deviceID: this._getCookie('uuid')
                },
                dataType: 'json'
            }).done(function( msg ) {
                success(msg);
            }.bind(this))
            .fail(function( msg ) {
                errors('Notificare: Failed to register custom event');
            }.bind(this));
        },
        /**
         * Get tags for a device
         * @param success
         * @param errors
         */
        getTags: function (success, errors) {
            if (this._getCookie('uuid')) {
                $.ajax({
                    type: "GET",
                    url: this.options.apiUrl + '/device/' + this._getCookie('uuid') + '/tags',
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this)
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
            if (this._getCookie('uuid')) {
                $.ajax({
                    type: "PUT",
                    url: this.options.apiUrl + '/device/' + this._getCookie('uuid') + '/addtags',
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this),
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

            if (this._getCookie('uuid')) {
                $.ajax({
                    type: "PUT",
                    url: this.options.apiUrl + '/device/' + this._getCookie('uuid') + '/removetag',
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this),
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

            if (this._getCookie('uuid')) {
                $.ajax({
                    type: "PUT",
                    url: this.options.apiUrl + '/device/' + this._getCookie('uuid') + '/cleartags',
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this),
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

            if (this._getCookie('uuid')) {

                if (this.applicationInfo.services && this.applicationInfo.services.locationServices) {

                    if (navigator.geolocation) {
                        navigator.geolocation.watchPosition(function(position){

                            this._getDeviceCountry(position, function(data){
                                this.updateLocation(position, data.country, function(data){
                                    this._getNearestRegions(position, function(regions){
                                        this._handleRegions(position, regions);
                                        success(data);
                                    }.bind(this), function(errors){

                                    });


                                }.bind(this), function(){
                                    errors("Notificare: Failed to update device location");
                                });
                            }.bind(this));


                        }.bind(this), function(error){
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
                    errors("Notificare: Your account does not support Location Services");
                }

            } else {
                errors("Notificare: Calling startLocationUpdates before registering a deviceId");
            }
        },

        /**
         * Stop location updates
         */
        stopLocationUpdates: function(){
            if (this.applicationInfo.services && this.applicationInfo.services.locationServices) {
                if (navigator.geolocation) {
                    navigator.geolocation.clearWatch();
                }
            } else {
                this.log("Notificare: Your account does not support Location Services");
            }
        },

        /**
         * Update device location
         * @param position
         * @param country
         * @param callback
         */
        updateLocation: function(position, country, success, errors){

            var cachedPosition = JSON.parse(localStorage.getItem("position"));

            if(cachedPosition.latitude != position.coords.latitude || cachedPosition.longitude != position.coords.longitude){

                $.ajax({
                    type: "PUT",
                    url: this.options.apiUrl + '/device/' + this._getCookie('uuid'),
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this),
                    data: {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        country: country
                    },
                    dataType: 'json'
                }).done(function( msg ) {
                    localStorage.setItem("position", JSON.stringify({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    }));
                    success({
                        accuracy: (!isNaN(position.coords.accuracy)) ? position.coords.accuracy : null,
                        altitude: (!isNaN(position.coords.altitude)) ? position.coords.altitude : null,
                        altitudeAccuracy: (!isNaN(position.coords.altitudeAccuracy)) ? position.coords.altitudeAccuracy : null,
                        heading: (!isNaN(position.coords.heading)) ? position.coords.heading : null,
                        speed: (!isNaN(position.coords.speed)) ? position.coords.speed : null,
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        country: country
                    });
                }.bind(this))
                .fail(function( msg ) {
                    errors(null);
                }.bind(this));

            } else {
                this.log("Notificare: Skipped location update, nothing changed");
                success({
                    accuracy: (!isNaN(position.coords.accuracy)) ? position.coords.accuracy : null,
                    altitude: (!isNaN(position.coords.altitude)) ? position.coords.altitude : null,
                    altitudeAccuracy: (!isNaN(position.coords.altitudeAccuracy)) ? position.coords.altitudeAccuracy : null,
                    heading: (!isNaN(position.coords.heading)) ? position.coords.heading : null,
                    speed: (!isNaN(position.coords.speed)) ? position.coords.speed : null,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    country: country
                });
            }



        },

        _handleRegions: function(position, regions){

            $.each( regions, function( index, region ){
                var localRegions = JSON.parse(localStorage.getItem("regions"));
                if(this._calculateDistanceBetweenPoints(position, region) <= region.distance){

                    if($.inArray(region._id, localRegions) == -1){
                        this._trigger("re.notifica.trigger.region.Enter", region, function(data){
                            localRegions.push(region._id);
                            localStorage.setItem("regions", JSON.stringify(localRegions));
                        }, function(errors){

                        });
                    }
                } else {

                    var i = $.inArray(region._id, localRegions);
                    if(i > -1){
                        this._trigger("re.notifica.trigger.region.Exit", region, function(data){
                            localRegions.splice(i, 1);
                            localStorage.setItem("regions", JSON.stringify(localRegions));
                        }, function(errors){

                        });
                    }
                }
            }.bind(this));

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
                url: this.options.apiUrl + '/region/bylocation/' + position.coords.latitude + '/' + position.coords.longitude,
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                }.bind(this),
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

            if (this._getCookie('uuid')) {
                $.ajax({
                    type: "POST",
                    url: this.options.apiUrl + '/reply',
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this),
                    data: {
                        userID: this.options.userId,
                        deviceID: this._getCookie('uuid'),
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
                url: this.options.apiUrl + '/trigger/' + type,
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                }.bind(this),
                data: {
                    region: region._id,
                    deviceID: this._getCookie('uuid')
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