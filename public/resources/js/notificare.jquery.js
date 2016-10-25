/*
 *  Notificare JS for jQuery - v1.9.0
 *  jQuery Library for Notificare
 *  http://notifica.re
 *
 *  @author Joel Oliveira joel@notifica.re
 *  copyright 2016 Notificare
 */

;(function ( $, window, document, undefined ) {

    // Create the defaults once
    var pluginName = "notificare",
        defaults = {
            sdkVersion: '1.9.2',
            websitePushUrl: "https://push.notifica.re/website-push/safari",
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
            this.chromePush = false;

            //Initial set of regions, location and badge
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

                if(!localStorage.getItem("badge")){
                    localStorage.setItem("badge", 0);
                }
            }

            if (typeof NOTIFICARE_PLUGIN_OPTIONS  !== 'undefined') {
                this.options = $.extend( {}, defaults, NOTIFICARE_PLUGIN_OPTIONS );
                if(this.options.useTestEnv){
                    this.options.apiUrl = "https://cloud-test.notifica.re/api";
                    this.options.awsStorage = "https://push-test.notifica.re/upload";
                } else {
                    this.options.apiUrl = "https://cloud.notifica.re/api";
                    this.options.awsStorage = "https://push.notifica.re/upload";
                }
                this._getApplicationInfo();
            } else {
                this._initWithConfig(function(options){
                    this.options = $.extend( {}, defaults, options );
                    if(this.options.useTestEnv){
                        this.options.apiUrl = "https://cloud-test.notifica.re/api";
                        this.options.awsStorage = "https://push-test.notifica.re/upload";
                    } else {
                        this.options.apiUrl = "https://cloud.notifica.re/api";
                        this.options.awsStorage = "https://push.notifica.re/upload";
                    }
                    this._getApplicationInfo();

                }.bind(this), function(errors){
                    console.warn('Notificare: Please make sure you have a config.json file in the root of your webapp');
                }.bind(this));
            }

        },

        _handleSession: function(){
            $(window).bind("focus",function(event){

                this.sessionDate = new Date();
                this.logEvent({
                    sessionID: this.uniqueId,
                    type: 're.notifica.event.application.Open',
                    userID: this.options.userId || null,
                    deviceID: this._getCookie('uuid') || null
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
                    userID: this.options.userId || null,
                    deviceID: this._getCookie('uuid') || null,
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

            var isServiceWorkerCapable = false;

            if(this.options.appHost.indexOf('localhost') > -1){
                isServiceWorkerCapable = true;
            } else if (this.options.appHost.indexOf('https') > -1){
                isServiceWorkerCapable = true;
            }

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

                } else if (navigator.userAgent.toLowerCase().indexOf('chrome') > -1 &&
                    'serviceWorker' in navigator &&
                    'showNotification' in ServiceWorkerRegistration.prototype &&
                    'PushManager' in window &&
                    isServiceWorkerCapable &&
                    this.options.serviceWorker &&
                    this.options.serviceWorkerScope) {

                    navigator.serviceWorker.register(this.options.serviceWorker, {
                        scope: this.options.serviceWorkerScope
                    }).then(function() {

                        //Worker is ready let's handle messages from it
                        navigator.serviceWorker.onmessage = function(msg){

                            if (msg && msg.data) {
                                var data = JSON.parse(msg.data);
                                switch(data.cmd) {
                                    case 'notificationclick':
                                        this._handleClickOnChromeNotification(data.message);
                                        break;
                                    case 'notificationreceive':
                                        this._getChromeNotification(data.message);
                                        break;
                                    case 'notificationreply':
                                        this._handleActionClickOnChromeNotification(data.message, data.action);
                                        break;
                                    case 'activate':
                                        this._sendMessage({
                                            action: "init",
                                            options: this.options
                                        });
                                        break;
                                    default:
                                        break;
                                }
                            }

                        }.bind(this);

                        navigator.serviceWorker.ready.then(function(serviceWorkerRegistration){

                            // Are Notifications supported in the service worker?
                            serviceWorkerRegistration.pushManager.getSubscription().then(function(subscription) {
                                // Enable any UI which subscribes / unsubscribes from
                                // push messages.
                                if (!subscription) {
                                    // subscribe for push notifications
                                    serviceWorkerRegistration.pushManager.subscribe({
                                        name: 'push',
                                        userVisibleOnly: true
                                    }).then(function(subscription) {
                                        // The subscription was successful
                                        pushToken = this._getPushToken(subscription);
                                        this.allowedNotifications = true;
                                        this.chromePush = true;
                                        $(this.element).trigger("notificare:didReceiveDeviceToken", pushToken);

                                        //It's the first time, let's create an install event
                                        this.logEvent({
                                            sessionID: this.uniqueId,
                                            type: 're.notifica.event.application.Install'
                                        },  function(data){

                                        }, function(error){

                                        });

                                    }.bind(this)).catch(function(e) {
                                        if (Notification.permission === 'denied') {
                                            if(this.options.allowSilent){
                                                this._setSocket();
                                            }
                                        } else {
                                            setTimeout(function() {
                                                this.registerForNotifications();
                                            }.bind(this), 2000);
                                        }
                                    }.bind(this));
                                    return;
                                }
                                var pushToken = this._getPushToken(subscription);
                                this.allowedNotifications = true;
                                this.chromePush = true;
                                $(this.element).trigger("notificare:didReceiveDeviceToken", pushToken);

                            }.bind(this)).catch(function(err) {
                                //Let's try again
                                setTimeout(function() {
                                    this.registerForNotifications();
                                }.bind(this), 2000);
                            }.bind(this));
                        }.bind(this));

                    }.bind(this)).catch(function(err) {
                        setTimeout(function() {
                            this.registerForNotifications();
                        }.bind(this), 2000);
                    }.bind(this));

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

        badge: function () {
            return localStorage.getItem('badge');
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
                            this._refreshBadge();
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

        _getPushToken: function(pushSubscription){
            var pushToken = '';
            if (pushSubscription.subscriptionId) {
                pushToken = pushSubscription.subscriptionId;
            } else {
                pushToken = pushSubscription.endpoint.split('/').pop();
            }
            return pushToken;
        },
        /**
         * API Requests
         */
        /**
         * Get Config File
         * @private
         */
        _initWithConfig: function (success, errors) {

            $.ajax({
                type: "GET",
                url: '/config.json'
            }).done(function( msg ) {

                success(msg);

            }.bind(this)).fail(function(  jqXHR, textStatus, errorThrown ) {
                errors(msg);
            }.bind(this));

        },
        /**
         * Get Application Info
         * @private
         */
        _getApplicationInfo: function () {

            if (this.options.appKey && this.options.appSecret) {

                $.ajax({
                    type: "GET",
                    url: this.options.apiUrl + '/application/info',
                    crossDomain: true,
                    beforeSend: function (xhr) {
                        xhr.withCredentials = true;
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this)
                }).done(function( msg ) {
                    this.applicationInfo = msg.application;
                    this.services = msg.application.services;

                    $(this.element).trigger("notificare:onReady", msg.application);

                    this._handleSession();

                    this._onURLLocationChanged();


                }.bind(this)).fail(function(  jqXHR, textStatus, errorThrown ) {

                    if( jqXHR.status == 502 ||
                        jqXHR.status == 503 ||
                        jqXHR.status == 504 ||
                        jqXHR.status < 0  ) {
                        setTimeout(function() {
                            this._getApplicationInfo();
                        }.bind(this), 2000);
                    }

                }.bind(this));

            } else {

                console.warn('Notificare: Please make sure you provide proper application keys');

            }


        },

        _sendMessage: function(message) {
            // This wraps the message posting/response in a promise, which will resolve if the response doesn't
            // contain an error, and reject with the error if it does. If you'd prefer, it's possible to call
            // controller.postMessage() and set up the onmessage handler independently of a promise, but this is
            // a convenient wrapper.
            return new Promise(function(resolve, reject) {
                var messageChannel = new MessageChannel();
                messageChannel.port1.onmessage = function(event) {
                    if (event.data.error) {
                        reject(event.data.error);
                    } else {
                        resolve(event.data);
                    }
                };

                // This sends the message data as well as transferring messageChannel.port2 to the service worker.
                // The service worker can then use the transferred port to reply via postMessage(), which
                // will in turn trigger the onmessage handler on messageChannel.port1.
                // See https://html.spec.whatwg.org/multipage/workers.html#dom-worker-postmessage
                navigator.serviceWorker.controller.postMessage(JSON.stringify(message), [messageChannel.port2]);
            });
        },
        /**
         *
         * Register Device
         * @param uuid
         */
        registerDevice: function (uuid) {
            var d = new Date();

            var platform = this.options.clientInfo.getOS().name;
            if(this.safariPush){
                platform = 'Safari';
            } else if(this.chromePush){
                platform = 'Chrome';
            }

            var transport = 'Websocket';
            if(this.safariPush){
                transport = 'WebsitePush';
            } else if(this.chromePush){
                transport = 'GCM';
            }

            $.ajax({
                type: "POST",
                url: this.options.apiUrl + '/device',
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                }.bind(this),
                data: JSON.stringify({
                    auth_token: this.options.token,
                    deviceID : uuid,
                    oldDeviceID: (this._getCookie('uuid') && this._getCookie('uuid') != uuid) ? this._getCookie('uuid') : null,
                    userID : (this.options.userId) ? this.options.userId : null,
                    userName : (this.options.username) ? this.options.username : null,
                    platform : platform,
                    osVersion : this.options.clientInfo.getOS().version,
                    sdkVersion : this.options.sdkVersion,
                    appVersion : this.options.appVersion,
                    language: window.navigator.userLanguage || window.navigator.language,
                    deviceString : window.navigator.platform, //to get better
                    transport : transport,
                    timeZoneOffset : (d.getTimezoneOffset()/60) * -1
                }),
                contentType: "application/json; charset=utf-8",
                dataType: "json"
            }).done(function( msg ) {
                this._setCookie(uuid);
                this._refreshBadge();
                $(this.element).trigger("notificare:didRegisterDevice", uuid);
            }.bind(this)).fail(function(  jqXHR, textStatus, errorThrown ) {
                $(this.element).trigger("notificare:didFailToRegisterDevice", uuid);
            }.bind(this));
        },

        /**
         *
         * Unregister Device
         */
        unregisterDevice: function (success, errors) {

            if (this._getCookie('uuid')) {
                $.ajax({
                    type: "DELETE",
                    url: this.options.apiUrl + '/device/' + this._getCookie('uuid'),
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this)
                }).done(function( msg ) {
                        this._setCookie("");
                        localStorage.setItem("badge", 0);
                        $(this.element).trigger("notificare:didUpdateBadge", 0);
                        success(msg);
                    }.bind(this))
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
                        errors("Notificare: Failed to delete a UUID");
                    }.bind(this));
            }

        },
        /**
         * Get a notification object
         * @param notification
         * @private
         */
        _getNotification: function (notification) {

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

                this.logEvent({
                    sessionID: this.uniqueId,
                    type: 're.notifica.event.notification.Receive',
                    notification: notification.notificationId || notification.id,
                    userID: this.options.userId || null,
                    deviceID: this._getCookie('uuid')
                },  function(data){

                }, function(error){

                });

                $(this.element).trigger("notificare:didReceiveNotification", notification);

            }.bind(this)).fail(function(  jqXHR, textStatus, errorThrown ) {
                setTimeout(function() {
                    this._getNotification(notification);
                }.bind(this), 2000);
            }.bind(this));

        },


        /**
         * Get a notification object for a Chrome event
         * @param notification
         * @private
         */
        _getChromeNotification: function (notification) {

            $.ajax({
                type: "GET",
                url: this.options.apiUrl + '/notification/' + notification,
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                }.bind(this)
            }).done(function( msg ) {

                this.logEvent({
                    sessionID: this.uniqueId,
                    type: 're.notifica.event.notification.Receive',
                    notification: notification,
                    userID: this.options.userId || null,
                    deviceID: this._getCookie('uuid')
                },  function(data){

                }, function(error){

                });

                $(this.element).trigger("notificare:didReceiveNotification", msg.notification);

                if(this.allowedNotifications){
                    if(this.options.soundsDir && msg.notification.sound){
                        var audio = new Audio(this.options.soundsDir + msg.notification.sound);
                        audio.load();
                        audio.play();
                    }
                }

                this._refreshBadge();
            }.bind(this)).fail(function(  jqXHR, textStatus, errorThrown ) {
                setTimeout(function() {
                    this._getChromeNotification(notification);
                }.bind(this), 2000);
            }.bind(this));

        },

        /**
         * Handle click of a Chrome Notification
         * @param notification
         * @private
         */
        _handleClickOnChromeNotification: function(notification){
            var url = this.applicationInfo.websitePushConfig.urlFormatString.replace("%@", notification);
            window.location.replace(url);
            this._onURLLocationChanged();
        },

        /**
         * Handle action click of a Chrome Notification
         * @param notification
         * @private
         */
        _handleActionClickOnChromeNotification: function(notification, label){

            $.ajax({
                type: "GET",
                url: this.options.apiUrl + '/notification/' + notification,
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                }.bind(this)
            }).done(function( msg ) {

                this._logNotificationEvents(msg);
                this._refreshBadge();

                if (msg && msg.notification && msg.notification.actions && msg.notification.actions.length > 0) {

                    msg.notification.actions.forEach(function(action){
                        if (action.label == label) {
                            this._executeAction(msg, action);
                        }
                    }.bind(this));

                }

            }.bind(this)).fail(function(  jqXHR, textStatus, errorThrown ) {
                setTimeout(function() {
                    this._handleActionClickOnChromeNotification(notification, label);
                }.bind(this), 2000);
            }.bind(this));
        },

        /**
         * Helper method to execute the action
         * @private
         */
        _executeAction: function(msg, action){

            if (action) {

                $(this.element).trigger("notificare:willExecuteAction", msg.notification);

                var data = {};

                if (action.type == "re.notifica.action.Browser" && action.target) {
                    window.location.replace(action.target);
                    this._replyOnAction(msg, action, data);
                } else if (action.type == "re.notifica.action.Callback") {

                    if (action.camera && action.keyboard && !action.target) {

                        this._executeCameraAndKeyboard(msg, action, data);

                    } else if (action.camera && !action.keyboard && !action.target) {

                        this._executeCamera(msg, action, data);

                    } else if (!action.camera && action.keyboard && !action.target) {

                        this._executeKeyboard(msg, action, data);

                    } else {

                        if (action.target) {
                            this._executeWebHook(msg, action, data);
                        } else {
                            this._replyOnAction(msg, action, null);
                        }

                    }

                } else if (action.type == "re.notifica.action.Mail") {
                    window.location.href = 'mailto:' + action.target;
                    this._replyOnAction(msg, action, data);
                } else if (action.type == "re.notifica.action.Custom") {
                    $(this.element).trigger("notificare:shouldPerformActionWithURL", action.target);
                    this._replyOnAction(msg, action, data);
                } else {
                    $(this.element).trigger("notificare:didFailToExecuteAction", msg.notification);
                }

            }

        },

        /**
         * Helper method on reply on action
         * @param msg
         * @param action
         * @param data
         * @private
         */
        _replyOnAction: function(msg, action, data){
            this.reply(msg.notification._id, action.label, data, function(){
                $(this.element).trigger("notificare:didExecuteAction", msg.notification);
            }, function(){
                $(this.element).trigger("notificare:didFailToExecuteAction", msg.notification);
            });

        },

        /**
         * Helper method to execute a webhook
         * @param msg
         * @param action
         * @param data
         * @private
         */
        _executeWebHook: function(msg, action, data){

            var queries, temp, i, l;

            var queryString =  action.target.split("?");

            if (queryString.length > 1) {
                queries = queryString[1].split("&");
                // Convert the array of strings into an object
                for ( i = 0, l = queries.length; i < l; i++ ) {
                    temp = queries[i].split('=');
                    data[temp[0]] = temp[1];
                }
            }
            data.target = queryString[0];
            data.label = action.label;

            if (msg.notification._id) {
                data.notificationID = msg.notification._id;
            }

            if (this._getCookie('uuid')) {
                data.deviceID = this._getCookie('uuid');
            }

            if (this.options.userId) {
                data.userID = this.options.userId;
            }


            $.ajax({
                type: "POST",
                url: this.options.apiUrl + '/reply/webhook',
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                }.bind(this),
                data: JSON.stringify(data),
                contentType: "application/json; charset=utf-8",
                dataType: "json"
            }).done(function( reply ) {

                this._replyOnAction(msg, action, data);

            }.bind(this)).fail(function(  jqXHR, textStatus, errorThrown ) {
                setTimeout(function() {
                    this._executeWebHook(msg, action, data);
                }.bind(this), 2000);
            }.bind(this));

        },

        /**
         * Helper method for keyboard flow
         * @param msg
         * @param action
         * @param data
         * @private
         */
        _executeKeyboard: function(msg, action, data){

            if ($('.notificare-modal-bg')) {
                $('.notificare-modal-bg').remove();
            }

            var textarea = $("<textarea>", {"class": "notificare-text-area"}),
                send = $("<a>", {"class": "notificare-send", "href":"#"}),
                close = $("<a>", {"class": "notificare-close-modal", "href":"#"}),
                modal = $("<div>", {"class": "notificare-modal"}),
                bg = $("<div>", {"class": "notificare-modal-bg"});

            textarea.attr('placeholder', 'Type a reply');
            send.text("Send");
            close.text("Close");


            modal.append(textarea);
            modal.append(send);
            modal.append(close);
            bg.append(modal);
            $("body").append(bg);

            send.click(function(e){
                e.preventDefault();
                data = {message: textarea.val()};
                this._replyOnAction(msg, action, data);
                bg.remove();

            }.bind(this));

            close.click(function(e){
                e.preventDefault();
                $(this.element).trigger("notificare:didNotExecuteAction", msg.notification);
                bg.remove();
            }.bind(this));


        },

        /**
         * Helper method for camera flow
         * @param msg
         * @param action
         * @param data
         * @private
         */
        _executeCamera: function(msg, action, data){

            if ($('.notificare-modal-bg')) {
                $('.notificare-modal-bg').remove();
            }

            var canvas = $("<canvas>", {"class": "notificare-image"}),
                context = canvas.get(0).getContext('2d'),
                video = $("<video>", {"class": "notificare-camera"}),
                send = $("<a>", {"class": "notificare-send", "href":"#"}),
                cancel = $("<a>", {"class": "notificare-cancel", "href":"#"}),
                close = $("<a>", {"class": "notificare-close-modal", "href":"#"}),
                button = $("<a>", {"class": "notificare-capture-image", "href":"#"}),
                modal = $("<div>", {"class": "notificare-modal"}),
                bg = $("<div>", {"class": "notificare-modal-bg"});

            cancel.text("Cancel");
            send.text("Send");
            button.text("Take Picture");
            close.text("Close");

            // Get access to the camera!
            if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {

                navigator.mediaDevices.getUserMedia({
                    video: true
                }).then(function(stream) {

                    video.get(0).src = window.URL.createObjectURL(stream);
                    video.get(0).play();

                    modal.append(video);
                    modal.append(button);
                    modal.append(canvas);
                    modal.append(send);
                    modal.append(cancel);
                    modal.append(close);
                    bg.append(modal);
                    $("body").append(bg);
                    canvas.hide();
                    send.hide();
                    cancel.hide();

                    button.click(function(e){
                        e.preventDefault();
                        context.drawImage(video.get(0), 0, 0, 320, 180);
                        video.hide();
                        button.hide();
                        close.hide();
                        canvas.show();
                        send.show();
                        cancel.show();

                        video.get(0).src = "";
                        video.get(0).pause();

                    }.bind(this));


                    send.click(function(e){
                        e.preventDefault();
                        var dataURL = canvas.get(0).toDataURL("image/png"),
                            blob = this._dataURItoBlob(dataURL);

                        this.uploadFile(blob, 'reply', function(fileURL){
                            data = {media: fileURL};
                            this._replyOnAction(msg, action, data);

                        }.bind(this), function(){

                        }.bind(this));

                        video.get(0).src = "";
                        video.get(0).pause();
                        stream.getTracks()[0].stop();
                        bg.remove();

                    }.bind(this));

                    cancel.click(function(e){
                        e.preventDefault();
                        canvas.hide();
                        send.hide();
                        cancel.hide();
                        video.show();
                        button.show();
                        close.show();

                        video.get(0).src = window.URL.createObjectURL(stream);
                        video.get(0).play();

                    }.bind(this));

                    close.click(function(e){
                        e.preventDefault();
                        video.get(0).src = "";
                        video.get(0).pause();
                        stream.getTracks()[0].stop();
                        $(this.element).trigger("notificare:didNotExecuteAction", msg.notification);
                        bg.remove();
                    }.bind(this));

                }.bind(this));

            }

        },

        /**
         * Helper method for camera & keyboard flow
         * @param msg
         * @param action
         * @param data
         * @private
         */
        _executeCameraAndKeyboard: function(msg, action, data){

            if ($('.notificare-modal-bg')) {
                $('.notificare-modal-bg').remove();
            }

            var canvas = $("<canvas>", {"class": "notificare-image"}),
                textarea = $("<textarea>", {"class": "notificare-text-area"}),
                context = canvas.get(0).getContext('2d'),
                video = $("<video>", {"class": "notificare-camera"}),
                next = $("<a>", {"class": "notificare-send", "href":"#"}),
                send = $("<a>", {"class": "notificare-send", "href":"#"}),
                cancel = $("<a>", {"class": "notificare-cancel", "href":"#"}),
                close = $("<a>", {"class": "notificare-close-modal", "href":"#"}),
                button = $("<a>", {"class": "notificare-capture-image", "href":"#"}),
                modal = $("<div>", {"class": "notificare-modal"}),
                bg = $("<div>", {"class": "notificare-modal-bg"});

            textarea.attr('placeholder', 'Type a reply');
            cancel.text("Cancel");
            next.text("Next");
            send.text("Send");
            button.text("Take Picture");
            close.text("Close");

            // Get access to the camera!
            if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {

                navigator.mediaDevices.getUserMedia({
                    video: true
                }).then(function(stream) {

                    video.get(0).src = window.URL.createObjectURL(stream);
                    video.get(0).play();

                    modal.append(textarea);
                    modal.append(video);
                    modal.append(button);
                    modal.append(canvas);
                    modal.append(send);
                    modal.append(next);
                    modal.append(cancel);
                    modal.append(close);
                    bg.append(modal);
                    $("body").append(bg);
                    canvas.hide();
                    textarea.hide();
                    send.hide();
                    cancel.hide();
                    next.hide();

                    button.click(function(e){
                        e.preventDefault();
                        context.drawImage(video.get(0), 0, 0, 320, 180);
                        video.hide();
                        button.hide();
                        close.hide();
                        canvas.show();
                        next.show();
                        cancel.show();

                        video.get(0).src = "";
                        video.get(0).pause();

                    }.bind(this));


                    next.click(function(e){
                        e.preventDefault();
                        var dataURL = canvas.get(0).toDataURL("image/png"),
                            blob = this._dataURItoBlob(dataURL);

                        this.uploadFile(blob, 'reply', function(fileURL){
                            data = {media: fileURL};
                            textarea.show();
                            send.show();
                            canvas.hide();
                            next.hide();

                        }.bind(this), function(){

                        }.bind(this));

                        video.get(0).src = "";
                        video.get(0).pause();
                        stream.getTracks()[0].stop();

                    }.bind(this));


                    send.click(function(e){
                        e.preventDefault();
                        data['message'] = textarea.val();
                        this._replyOnAction(msg, action, data);
                        bg.remove();
                    }.bind(this));

                    cancel.click(function(e){
                        e.preventDefault();
                        canvas.hide();
                        send.hide();
                        cancel.hide();
                        next.hide();
                        textarea.hide();
                        video.show();
                        button.show();
                        close.show();

                        video.get(0).src = window.URL.createObjectURL(stream);
                        video.get(0).play();

                    }.bind(this));

                    close.click(function(e){
                        e.preventDefault();
                        video.get(0).src = "";
                        video.get(0).pause();
                        stream.getTracks()[0].stop();
                        $(this.element).trigger("notificare:didNotExecuteAction", msg.notification);
                        bg.remove();
                    }.bind(this));

                }.bind(this));

            }

        },
        /**
         * Data URI from Blob
         * @param dataURI
         * @returns {*}
         * @private
         */
        _dataURItoBlob: function(dataURI) {
            // convert base64/URLEncoded data component to raw binary data held in a string
            var byteString,
                mimestring

            if(dataURI.split(',')[0].indexOf('base64') !== -1 ) {
                byteString = atob(dataURI.split(',')[1])
            } else {
                byteString = decodeURI(dataURI.split(',')[1])
            }

            mimestring = dataURI.split(',')[0].split(':')[1].split(';')[0]

            var content = new Array();
            for (var i = 0; i < byteString.length; i++) {
                content[i] = byteString.charCodeAt(i)
            }

            return new Blob([new Uint8Array(content)], {type: mimestring});
        },

        /**
         * Upload a file of type
         * @param type
         * @param success
         * @param errors
         */
        uploadFile: function(file, type, success, errors) {

            var formData = new FormData();
            formData.append('file', file);

            $.ajax({
                type: "POST",
                url: this.options.apiUrl + '/upload/' + type,
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                }.bind(this),
                data: formData,
                contentType: false,
                processData: false
            }).done(function( reply ) {

                success('https://s3-eu-west-1.amazonaws.com/notificare-storage' + reply.filename);

            }.bind(this)).fail(function(  jqXHR, textStatus, errorThrown ) {

                errors('Notificare: Failed to upload the image');

            }.bind(this));

        },
        /**
         * Helper method to check if user is registered
         * @returns {boolean}
         */
        isDeviceRegistered: function(){
            if(this._getCookie('uuid')){
                return true;
            } else {
                return false;
            }
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
                this._refreshBadge();
                this._logNotificationEvents(msg);
            }.bind(this)).fail(function(  jqXHR, textStatus, errorThrown ) {
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

            if (msg && msg.notification && msg.notification.message) {
                if ("Notification" in window) {

                    try {
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

                    } catch (e) {

                        //If native Notification is not possible use the window.confirm
                        var n = window.confirm(msg.notification.message);

                        if (n == true) {
                            var url = this.applicationInfo.websitePushConfig.urlFormatString.replace("%@", msg.notification._id);
                            window.location.replace(url);
                            this._onURLLocationChanged();
                        }

                    }

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

                } else {

                    //If native Notification is not possible use the window.confirm
                    var n = window.confirm(msg.notification.message);

                    if (n == true) {
                        var url = this.applicationInfo.websitePushConfig.urlFormatString.replace("%@", msg.notification._id);
                        window.location.replace(url);
                        this._onURLLocationChanged();
                    }
                }
            }

            this._refreshBadge();

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
                this._refreshBadge();
            }.bind(this), function(error){

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
                data: JSON.stringify(data),
                contentType: "application/json; charset=utf-8",
                dataType: "json"
            }).done(function( msg ) {
                    success(msg);
                }.bind(this))
                .fail(function(  jqXHR, textStatus, errorThrown ) {
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
                data: JSON.stringify({
                    sessionID: this.uniqueId,
                    type: 're.notifica.event.custom.' + event,
                    userID: this.options.userId || null,
                    deviceID: this._getCookie('uuid')
                }),
                contentType: "application/json; charset=utf-8",
                dataType: "json"
            }).done(function( msg ) {
                    success(msg);
                }.bind(this))
                .fail(function(  jqXHR, textStatus, errorThrown ) {
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
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
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
                    data: JSON.stringify({
                        tags: data
                    }),
                    contentType: "application/json; charset=utf-8",
                    dataType: "json"
                }).done(function( msg ) {
                        success(msg);
                    }.bind(this))
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
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
                    data: JSON.stringify({
                        tag: data
                    }),
                    contentType: "application/json; charset=utf-8",
                    dataType: "json"
                }).done(function( msg ) {
                        success(msg);
                    }.bind(this))
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
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
                    contentType: "application/json; charset=utf-8",
                    dataType: "json"
                }).done(function( msg ) {
                        success(msg);
                    }.bind(this))
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
                        errors("Failed to clear device tags.");
                    }.bind(this));
            } else {
                errors("Notificare: Calling clearTags before registering a deviceId");
            }
        },


        /**
         * Fetch User Data
         * @param success
         * @param errors
         */
        fetchUserData: function (success, errors) {
            if (this._getCookie('uuid')) {
                $.ajax({
                    type: "GET",
                    url: this.options.apiUrl + '/device/' + this._getCookie('uuid') + '/userdata',
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this)
                }).done(function( msg ) {
                        success(msg.userData);
                    }.bind(this))
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
                        errors("Notificare: Failed to get user data for device");
                    }.bind(this));
            } else {
                errors('Notificare: Calling fetch user data before having a deviceId');
            }
        },
        /**
         * Update User Data
         * @param data
         * @param success
         * @param errors
         */
        updateUserData: function (data, success, errors) {
            if (this._getCookie('uuid')) {
                $.ajax({
                    type: "PUT",
                    url: this.options.apiUrl + '/device/' + this._getCookie('uuid') + '/userdata',
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this),
                    data: JSON.stringify(data),
                    contentType: "application/json; charset=utf-8",
                    dataType: "json"
                }).done(function( msg ) {
                        success(msg);
                    }.bind(this))
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
                        errors("Notificare: Failed to update user data for device");
                    }.bind(this));
            } else {
                errors("Notificare: Calling update user data before registering a deviceId");
            }
        },

        /**
         * Fetch Do Not Disturb
         * @param success
         * @param errors
         */
        fetchDoNotDisturb: function (success, errors) {
            if (this._getCookie('uuid')) {
                $.ajax({
                    type: "GET",
                    url: this.options.apiUrl + '/device/' + this._getCookie('uuid') + '/dnd',
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this)
                }).done(function( msg ) {
                        success(msg.dnd);
                    }.bind(this))
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
                        errors("Notificare: Failed to get dnd for device");
                    }.bind(this));
            } else {
                errors('Notificare: Calling fetch dnd before having a deviceId');
            }
        },
        /**
         * Update Do Not Disturb
         * @param data
         * @param success
         * @param errors
         */
        updateDoNotDisturb: function (start, end, success, errors) {
            if (this._getCookie('uuid')) {

                if (start && end) {

                    $.ajax({
                        type: "PUT",
                        url: this.options.apiUrl + '/device/' + this._getCookie('uuid') + '/dnd',
                        beforeSend: function (xhr) {
                            xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                        }.bind(this),
                        data: JSON.stringify({
                            start: start,
                            end: end
                        }),
                        contentType: "application/json; charset=utf-8",
                        dataType: "json"
                    }).done(function( msg ) {
                            success(msg);
                        }.bind(this))
                        .fail(function(  jqXHR, textStatus, errorThrown ) {
                            errors("Notificare: Failed to update dnd for device");
                        }.bind(this));
                } else {
                    errors("Notificare: Calling update dnd without a start and end time");
                }

            } else {
                errors("Notificare: Calling update dnd before registering a deviceId");
            }
        },
        /**
         * Clear Do Not Disturb
         * @param data
         * @param success
         * @param errors
         */
        clearDoNotDisturb: function (success, errors) {
            if (this._getCookie('uuid')) {
                $.ajax({
                    type: "PUT",
                    url: this.options.apiUrl + '/device/' + this._getCookie('uuid') + '/cleardnd',
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this),
                    data: null,
                    contentType: "application/json; charset=utf-8",
                    dataType: "json"
                }).done(function( msg ) {
                        success(msg);
                    }.bind(this))
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
                        errors("Notificare: Failed to clear dnd for device");
                    }.bind(this));
            } else {
                errors("Notificare: Calling clear dnd before registering a deviceId");
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

                            var cachedPosition = JSON.parse(localStorage.getItem("position"));

                            if(cachedPosition.latitude != position.coords.latitude || cachedPosition.longitude != position.coords.longitude){

                                this._getDeviceCountry(position, function(data){

                                    this.updateLocation(position, data.country, function(data){

                                        this._getNearestRegions(position, function(regions){
                                            this._handleRegions(position, regions);
                                            success(data);
                                        }.bind(this), function(error){
                                            errors("Notificare: Failed to get nearest regions");
                                        });

                                    }.bind(this), function(){
                                        errors("Notificare: Failed to update device location");
                                    });
                                }.bind(this));

                            } else {

                                //Location is the same, let's just check for regions
                                this._getNearestRegions(position, function(regions){
                                    this._handleRegions(position, regions);
                                    this.log("Notificare: Skipped location update, nothing changed");
                                    success(JSON.parse(localStorage.getItem("position")));
                                }.bind(this), function(error){
                                    errors("Notificare: Failed to get nearest regions");
                                });

                            }

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

            $.ajax({
                type: "PUT",
                url: this.options.apiUrl + '/device/' + this._getCookie('uuid'),
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                }.bind(this),
                data: JSON.stringify({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    country: country
                }),
                contentType: "application/json; charset=utf-8",
                dataType: "json"
            }).done(function( msg ) {
                    localStorage.setItem("position", JSON.stringify({
                        accuracy: (!isNaN(position.coords.accuracy)) ? position.coords.accuracy : null,
                        altitude: (!isNaN(position.coords.altitude)) ? position.coords.altitude : null,
                        altitudeAccuracy: (!isNaN(position.coords.altitudeAccuracy)) ? position.coords.altitudeAccuracy : null,
                        heading: (!isNaN(position.coords.heading)) ? position.coords.heading : null,
                        speed: (!isNaN(position.coords.speed)) ? position.coords.speed : null,
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        country: country,
                        timestamp: position.timestamp
                    }));
                    success(JSON.parse(localStorage.getItem("position")));
                }.bind(this))
                .fail(function(  jqXHR, textStatus, errorThrown ) {
                    errors(null);
                }.bind(this));

        },

        /**
         * Get the inbox for a specific device
         * @param success
         * @param errors
         */
        fetchInbox: function (success, errors) {
            if (this._getCookie('uuid')) {
                $.ajax({
                    type: "GET",
                    url: this.options.apiUrl + '/notification/inbox/fordevice/' + this._getCookie('uuid'),
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this)
                }).done(function( msg ) {
                        success(msg.inboxItems);
                    }.bind(this))
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
                        errors("Notificare: Failed to get the inbox");
                    }.bind(this));
            } else {
                errors('Notificare: Calling fetchInbox before having a deviceId');
            }
        },

        /**
         * Open Inbox Item
         * @param inboxItem
         */
        openInboxItem: function (inboxItem) {

            this.openNotification({
                id: inboxItem.notification
            });

        },
        /**
         * Mark Inbox Item as read
         * @param inboxItem
         * @param success
         * @param errors
         */
        markAsRead: function(inboxItem, success, errors){
            this.logEvent({
                sessionID: this.uniqueId,
                type: 're.notifica.event.notification.Open',
                notification: inboxItem.notification,
                userID: this.options.userId || null,
                deviceID: this._getCookie('uuid')
            },  function(data){
                this._refreshBadge();
                success(data);
            }, function(error){
                errors("Notificare: Failed to mark inbox item as read");
            });
        },

        /**
         * Clear inbox for a specific device
         * @param success
         * @param errors
         */
        clearInbox: function (success, errors) {
            if (this._getCookie('uuid')) {
                $.ajax({
                    type: "DELETE",
                    url: this.options.apiUrl + '/notification/inbox/fordevice/' + this._getCookie('uuid'),
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this)
                }).done(function( msg ) {
                        this._refreshBadge();
                        success(msg);
                    }.bind(this))
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
                        errors("Notificare: Failed to clear the inbox");
                    }.bind(this));
            } else {
                errors('Notificare: Calling clearInbox before having a deviceId');
            }
        },

        /**
         * Remove inbox item
         * @param success
         * @param errors
         */
        removeFromInbox: function (inboxItem, success, errors) {
            if (this._getCookie('uuid')) {
                $.ajax({
                    type: "DELETE",
                    url: this.options.apiUrl + '/notification/inbox/' + inboxItem._id,
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this)
                }).done(function( msg ) {
                        this._refreshBadge();
                        success(msg);
                    }.bind(this))
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
                        errors("Notificare: Failed to remove item from inbox");
                    }.bind(this));
            } else {
                errors('Notificare: Calling removeFromInbox before having a deviceId');
            }
        },


        /**
         * Helper method to get the latest unread number
         */
        _refreshBadge: function () {

            if (this._getCookie('uuid')) {
                $.ajax({
                    type: "GET",
                    url: this.options.apiUrl + '/notification/inbox/fordevice/' + this._getCookie('uuid'),
                    data:{
                        since: new Date().getTime()
                    },
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this)
                }).done(function( msg ) {
                        localStorage.setItem("badge", msg.unread);
                        $(this.element).trigger("notificare:didUpdateBadge", msg.unread);
                    }.bind(this))
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
                        $(this.element).trigger("notificare:didUpdateBadge", localStorage.getItem("badge"));
                    }.bind(this));
            } else {
                errors('Notificare: Refreshing Badge before having a deviceId');
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
                .fail(function(  jqXHR, textStatus, errorThrown ) {
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
                url: 'https://maps.googleapis.com/maps/api/geocode/json',
                data: {
                    latlng: position.coords.latitude + ',' + position.coords.longitude,
                    sensor: false
                }
            }).done(function( msg ) {

                    if(msg.status === 'OK' && msg.results && msg.results.length > 0){

                        var country;

                        for (i=0; i< msg.results[0].address_components.length; i++){
                            for (j=0; j< msg.results[0].address_components[i].types.length; j++){
                                if(msg.results[0].address_components[i].types[j] == "country")
                                    country = msg.results[0].address_components[i].short_name;
                            }
                        }

                        callback({
                            country: country
                        });
                    } else {
                        callback({
                            country: null
                        });
                    }

                }.bind(this))
                .fail(function(  jqXHR, textStatus, errorThrown ) {
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
        reply: function (notification, label, data, success, errors) {

            if (this._getCookie('uuid')) {
                $.ajax({
                    type: "POST",
                    url: this.options.apiUrl + '/reply',
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this),
                    data: JSON.stringify({
                        userID: this.options.userId,
                        deviceID: this._getCookie('uuid'),
                        notification: notification,
                        data: data,
                        label: label
                    }),
                    contentType: "application/json; charset=utf-8",
                    dataType: "json"
                }).done(function (msg) {
                        success(msg);
                    }.bind(this))
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
                        errors('Notificare: Failed to register reply');
                    }.bind(this));
            } else {
                errors("Notificare: Calling reply before registering a deviceId");
            }
        },

        /**
         * Fetch a list of assets for a group
         * @param group name
         */
        fetchAssets: function (group, success, errors) {

            if (this.applicationInfo.services.storage) {
                $.ajax({
                    type: "GET",
                    url: this.options.apiUrl + '/asset/forgroup/' + group,
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this)
                }).done(function( msg ) {

                        var assets = [];

                        $.each( msg.assets, function( index, asset ){
                            assets.push({
                                title: asset.title,
                                description: asset.description,
                                url: 'https://push.notifica.re/asset/file/' + asset.key,
                                metaData: asset.metaData,
                                button: asset.button
                            });
                        }.bind(this));

                        success(assets);
                    }.bind(this))
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
                        errors("Notificare: Failed to get assets for this group");
                    }.bind(this))
            } else {
                errors("Notificare: This is a add-on service, please activate in order to use this method");
            }

        },


        /**
         * Fetch a specific pass by serial
         * @param serial
         */
        fetchPass: function (serial, success, errors) {

            if (this.applicationInfo.services.passbook) {
                $.ajax({
                    type: "GET",
                    url: this.options.apiUrl + '/pass/forserial/' + serial,
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this)
                }).done(function( msg ) {
                        success(msg.pass);
                    }.bind(this))
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
                        errors("Notificare: Failed to get pass for this serial");
                    }.bind(this))
            } else {
                errors("Notificare: This is a add-on service, please activate in order to use this method");
            }

        },

        _trigger: function (type, region, success, errors) {

            $.ajax({
                type: "POST",
                url: this.options.apiUrl + '/trigger/' + type,
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                }.bind(this),
                data: JSON.stringify({
                    region: region._id,
                    deviceID: this._getCookie('uuid')
                }),
                contentType: "application/json; charset=utf-8",
                dataType: "json"
            }).done(function (msg) {
                    success(msg);
                }.bind(this))
                .fail(function(  jqXHR, textStatus, errorThrown ) {
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