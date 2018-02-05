/*
 *  Notificare JS for jQuery - v1.10.0
 *  jQuery Library for Notificare
 *  http://notifica.re
 *
 *  @author Joel Oliveira joel@notifica.re
 *  copyright 2017 Notificare
 */

;(function ( $, window, document, undefined ) {

    // Create the defaults once
    var pluginName = "notificare",
        defaults = {
            sdkVersion: '1.10.1',
            fullHost: window.location.protocol + '//' +  window.location.host,
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
         * Init the lib
         */
        init: function () {

            this.placeholder = $(document.createElement('div'));
            this.placeholder.addClass('notificare');
            this.uniqueId = this._getUniqueID();
            this.sessionDate = new Date();
            this.allowedNotifications = false;
            this.safariPush = false;
            this.webPush = false;
            this.serviceWorkerRegistration = null;
            this.navigatorWatchPosition = null;

            //Initial set of regions, location and badge
            if(typeof(Storage) !== "undefined") {
                if(!localStorage.getItem("regions")){
                    localStorage.setItem("regions", JSON.stringify([]));
                }

                if(!localStorage.getItem("position")){
                    localStorage.setItem("position", JSON.stringify({
                        latitude: 0.0,
                        longitude: 0.0
                    }));
                }

                if(!localStorage.getItem("badge")){
                    localStorage.setItem("badge", 0);
                }

                //In 1.9.8 we moving away from a cookie to local storage
                if (this._getCookie('uuid') && this._getCookie('uuid').length > 0) {
                    this._setDeviceToken(this._getCookie('uuid'));
                    this._setCookie("");
                }
            }

            if (typeof NOTIFICARE_PLUGIN_OPTIONS  !== 'undefined') {
                this.options = $.extend( {}, this.options, NOTIFICARE_PLUGIN_OPTIONS );
                if(this.options.useTestEnv){
                    this.options.apiUrl = "https://cloud-test.notifica.re/api";
                    this.options.awsStorage = "https://push-test.notifica.re/upload";
                    this.options.websitePushUrl = "https://push-test.notifica.re/website-push/safari";
                    this.options.assetsUrl = 'https://push-test.notifica.re/asset/file/';
                } else {
                    this.options.apiUrl = "https://cloud.notifica.re/api";
                    this.options.awsStorage = "https://push.notifica.re/upload";
                    this.options.websitePushUrl = "https://push.notifica.re/website-push/safari";
                    this.options.assetsUrl = 'https://push.notifica.re/asset/file/';
                }
                this._getApplicationInfo();
            } else {
                this._initWithConfig(function(options){
                    this.options = $.extend( {}, this.options, options );
                    if(this.options.useTestEnv){
                        this.options.apiUrl = "https://cloud-test.notifica.re/api";
                        this.options.awsStorage = "https://push-test.notifica.re/upload";
                        this.options.websitePushUrl = "https://push-test.notifica.re/website-push/safari";
                        this.options.assetsUrl = 'https://push-test.notifica.re/asset/file/';
                    } else {
                        this.options.apiUrl = "https://cloud.notifica.re/api";
                        this.options.awsStorage = "https://push.notifica.re/upload";
                        this.options.websitePushUrl = "https://push.notifica.re/website-push/safari";
                        this.options.assetsUrl = 'https://push.notifica.re/asset/file/';
                    }
                    this._getApplicationInfo();

                }.bind(this), function(errors){
                    this.log('Notificare: Please make sure you have a config.json file in the root of your webapp');
                }.bind(this));
            }

        },

        /**
         * Handle window focus and blur to log open/close events
         * @private
         */
        _handleSession: function(){
            $(window).bind("focus",function(event){

                this.sessionDate = new Date();
                this.logEvent({
                    sessionID: this.uniqueId,
                    type: 're.notifica.event.application.Open',
                    userID: this.options.userId || null,
                    deviceID: this._getDeviceToken() || null
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
                    deviceID: this._getDeviceToken() || null,
                    data: {
                        length: seconds
                    }
                }, function(data){
                    this.log("Notificare: Session:" + seconds + " seconds");
                }.bind(this), function(error){

                });
            }.bind(this));
        },

        /**
         * Query Navigator Permissions
         * @param permission
         * @param success
         * @param error
         */
        queryNavigatorPermissions: function(permission, success, error){
            navigator.permissions.query({name: permission}).then(function(result) {
                if (result.state === 'granted') {
                    success(result);
                } else {
                    error(result);
                }
            });
        },
        /**
         * Register for Notifications, triggered by the developer
         */
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

                        try {
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

                        } catch(err) {
                            $(this.element).trigger("notificare:didFailToReceiveDeviceToken", err);
                        }

                    } else if (data.permission == 'denied') {
                        $(this.element).trigger("notificare:didFailToReceiveDeviceToken", data);
                    } else if (data.permission == 'granted') {
                        this.allowedNotifications = true;
                        this.safariPush = true;
                        $(this.element).trigger("notificare:didReceiveDeviceToken", data.deviceToken);
                    }

                } else if ('serviceWorker' in navigator &&
                    'showNotification' in ServiceWorkerRegistration.prototype &&
                    'PushManager' in window) {

                    if (this.applicationInfo.websitePushConfig &&
                        this.applicationInfo.websitePushConfig.gcmApiKey &&
                        this.applicationInfo.websitePushConfig.vapid &&
                        this.applicationInfo.websitePushConfig.vapid.publicKey &&
                        this.options.serviceWorker &&
                        this.options.serviceWorkerScope) {


                        if (isServiceWorkerCapable) {

                            navigator.serviceWorker.register(this.options.serviceWorker, {
                                scope: this.options.serviceWorkerScope
                            }).then(function() {

                                //Worker is ready let's handle messages from it
                                navigator.serviceWorker.onmessage = function(msg){

                                    if (msg && msg.data) {
                                        var data = JSON.parse(msg.data);
                                        switch(data.cmd) {
                                            case 'notificationclick':
                                                this._handleClickOnWebPushNotification(data.message);
                                                break;
                                            case 'notificationreceive':
                                                this._getNotification(data.message);
                                                break;
                                            case 'notificationreply':
                                                this._handleActionClickOnWebPushNotification(data.message, data.action);
                                                break;
                                            case 'system':
                                                $(this.element).trigger("notificare:didReceiveSystemNotification", data);
                                                break;
                                            case 'activate':
                                                this._sendMessage({
                                                    action: "init",
                                                    options: this.options
                                                });
                                                break;
                                            case 'pushsubscriptionchange':
                                                //@TODO: register the device whenever this is triggered, this is not yet reliably supported by all browsers
                                                break;
                                            default:
                                                break;
                                        }
                                    }

                                }.bind(this);

                                navigator.serviceWorker.ready.then(function(serviceWorkerRegistration){

                                    this.serviceWorkerRegistration = serviceWorkerRegistration;
                                    // Are Notifications supported in the service worker?
                                    serviceWorkerRegistration.pushManager.getSubscription().then(function(subscription) {
                                        // Enable any UI which subscribes / unsubscribes from
                                        // push messages.
                                        if (!subscription || !subscription.options || !subscription.options.applicationServerKey || this._arrayBufferToBase64Url(subscription.options.applicationServerKey) !== this.applicationInfo.websitePushConfig.vapid.publicKey) {
                                            // subscribe for push notifications
                                            var subscriptionOptions = {
                                                name: 'push',
                                                userVisibleOnly: true
                                            };
                                            if (this.applicationInfo.websitePushConfig.vapid.publicKey) {
                                                subscriptionOptions.applicationServerKey = this._base64UrlToUint8Array(this.applicationInfo.websitePushConfig.vapid.publicKey);
                                            }
                                            serviceWorkerRegistration.pushManager.subscribe(subscriptionOptions).then(function(subscription) {
                                                // The subscription was successful
                                                this.allowedNotifications = true;
                                                this.webPush = true;
                                                // Send push keys along with event
                                                $(this.element).trigger("notificare:didReceiveDeviceToken", this._getPushToken(subscription));

                                                //It's the first time, let's create an install event
                                                this.logEvent({
                                                    sessionID: this.uniqueId,
                                                    type: 're.notifica.event.application.Install'
                                                },  function(data){

                                                }, function(error){

                                                });

                                            }.bind(this)).catch(function(e) {
                                                $(this.element).trigger("notificare:didFailToReceiveDeviceToken", e);
                                                if (Notification.permission === 'denied') {
                                                    //Do nothing
                                                } else if (this._arrayBufferToBase64Url(subscription.options.applicationServerKey) != this.applicationInfo.websitePushConfig.vapid.publicKey) {
                                                    //Unsubscribe and subscribe again

                                                    this.serviceWorkerRegistration.pushManager.getSubscription()
                                                        .then(function(subscription) {
                                                            if (subscription) {
                                                                return subscription.unsubscribe();
                                                            }
                                                        })
                                                        .catch(function(error) {
                                                            this.log('Notificare: Error unsubscribing service worker registration', error);
                                                        }.bind(this))
                                                        .then(function() {
                                                            $(this.element).trigger("notificare:didUnsubscribeForNotifications", "Notificare: Did unsubscribe and subscribe again due to mismatch in application server keys.");
                                                            this.registerForNotifications();
                                                        }.bind(this));
                                                } else {
                                                    setTimeout(function() {
                                                        this.registerForNotifications();
                                                    }.bind(this), 2000);
                                                }
                                            }.bind(this));
                                        } else {
                                            this.allowedNotifications = true;
                                            this.webPush = true;
                                            $(this.element).trigger("notificare:didReceiveDeviceToken", this._getPushToken(subscription));
                                        }
                                    }.bind(this)).catch(function(err) {
                                        $(this.element).trigger("notificare:didFailToReceiveDeviceToken", err);
                                        //Let's try again
                                        setTimeout(function() {
                                            this.registerForNotifications();
                                        }.bind(this), 2000);
                                    }.bind(this));
                                }.bind(this));

                            }.bind(this)).catch(function(err) {
                                $(this.element).trigger("notificare:didFailToReceiveDeviceToken", err);
                                setTimeout(function() {
                                    this.registerForNotifications();
                                }.bind(this), 2000);
                            }.bind(this));


                        } else {
                            $(this.element).trigger("notificare:didFailToReceiveDeviceToken", "Notificare: Service workers are only available over HTTPS or using localhost.");
                        }

                    } else {
                        $(this.element).trigger("notificare:didFailToReceiveDeviceToken", "Notificare: Please check your Website Push configurations in our dashboard before proceed. Missing a GCM/FCM Server Key, VAPID or incorrect path and scope to the service worker in config.json.");
                    }

                } else {
                    $(this.element).trigger("notificare:didFailToReceiveDeviceToken", "Notificare: Your browser does not support Service Workers nor Safari Website Push.");
                }

            } else {
                $(this.element).trigger("notificare:didFailToReceiveDeviceToken", "Notificare: Please check your Website Push configurations in our dashboard before proceed. Missing the App Icon and Allowed Domains.");
            }

        },

        /**
         * Helper method to check if user is registered
         * @returns {boolean}
         */
        isDeviceRegistered: function(){
            return !!this._getDeviceToken();
        },

        /**
         * Helper method to check is WebPush & Safari Push is supported
         * @returns {boolean}
         */
        isWebPushSupported: function() {
            return (('safari' in window && 'pushNotification' in window.safari) || ('serviceWorker' in navigator && 'showNotification' in ServiceWorkerRegistration.prototype && 'PushManager' in window));
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
         * Deprecated, use setDeviceToken
         */
        _setCookie: function ( id ) {
            var expiration = new Date();
            expiration.setDate( expiration.getDate() + this.options.daysToExpire );
            var value = escape( id ) + ( ( this.options.daysToExpire == null ) ? "" : "; expires=" + expiration.toUTCString());
            document.cookie = 'uuid' + "=" + value + "; path=/";
        },
        /**
         * Deprecated, use getDeviceToken
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
         * Setting the Device Token
         */
        _setDeviceToken: function ( id ) {
            localStorage.setItem("deviceToken", id);
        },
        /**
         * Deprecated, use getDeviceToken
         */
        _getDeviceToken: function () {
            return localStorage.getItem("deviceToken");
        },

        /**
         * Retrieve a Push Token
         * @param pushSubscription
         * @returns {{endpoint: *, keys: (*|{p256dh, auth})}}
         * @private
         */
        _getPushToken: function(pushSubscription) {
            return {
                endpoint: pushSubscription.endpoint,
                keys: this._getPushKeys(pushSubscription)
            }
        },

        /**
         * Retrieve Push Keys
         * @param pushSubscription
         * @returns {*}
         * @private
         */
        _getPushKeys: function(pushSubscription) {
            if (pushSubscription && pushSubscription.getKey) {
                var rawKey = pushSubscription.getKey('p256dh');
                var rawAuthSecret = pushSubscription.getKey('auth');
                if (rawKey && rawAuthSecret) {
                    return {
                        p256dh: this._arrayBufferToBase64(rawKey),
                        auth: this._arrayBufferToBase64(rawAuthSecret)
                    };
                } else {
                    return null;
                }
            } else {
                return null;
            }
        },

        /**
         * Convert URL-safe base64
         * @param base64UrlData
         * @returns {Uint8Array}
         */
        _base64UrlToUint8Array: function(base64UrlData) {
            var padding = '='.repeat((4 - base64UrlData.length % 4) % 4);
            var base64 = (base64UrlData + padding).replace(/\-/g, '+').replace(/_/g, '/');

            var rawData = window.atob(base64);
            var buffer = new Uint8Array(rawData.length);

            for (var i = 0; i < rawData.length; ++i) {
                buffer[i] = rawData.charCodeAt(i);
            }
            return buffer;
        },

        _arrayBufferToBase64: function(buffer) {
            return this._uint8ArrayToBase64(new Uint8Array(buffer));
        },

        _arrayBufferToBase64Url: function(buffer) {
            return this._uint8ArrayToBase64Url(new Uint8Array(buffer));
        },

        _uint8ArrayToBase64: function(bytes) {
            var rawData = '';
            const len = bytes.byteLength;
            for (var i = 0; i < len; i++) {
                rawData += String.fromCharCode(bytes[i]);
            }
            return window.btoa(rawData);
        },

        _uint8ArrayToBase64Url: function(bytes) {
            return this._uint8ArrayToBase64(bytes).replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/g, '');
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
                errors(jqXHR);
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

                this.log('Notificare: Please make sure you provide proper application keys');

            }


        },

        /**
         * Handle Messages to worker
         * @param message
         * @returns {Promise}
         * @private
         */
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
         * @param keys
         */
        registerDevice: function (pushToken) {
            var d = new Date();

            var platform = this.options.clientInfo.getBrowser().name;
            var transport = "N/A";

            if(this.safariPush){
                platform = 'Safari';
                transport = 'WebsitePush';
            } else if(this.webPush){
                transport = 'WebPush';
            }

            var uuid, keys;
            if (pushToken.endpoint) {
                uuid = pushToken.endpoint;
                keys = pushToken.keys;
            } else {
                uuid = pushToken;
            }

            var lang = window.navigator.userLanguage || window.navigator.language,
                language = lang.split('-');


            $.ajax({
                type: "POST",
                url: this.options.apiUrl + '/device',
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                }.bind(this),
                data: JSON.stringify({
                    deviceID : uuid,
                    oldDeviceID: (this._getDeviceToken() && this._getDeviceToken() != uuid) ? this._getDeviceToken() : null,
                    keys: keys,
                    userID : (this.options.userId) ? this.options.userId : null,
                    userName : (this.options.username) ? this.options.username : null,
                    platform : platform,
                    osString : this.options.clientInfo.getBrowser().name + ' ' + this.options.clientInfo.getBrowser().major,
                    osVersion : this.options.clientInfo.getBrowser().major,
                    sdkVersion : this.options.sdkVersion,
                    appVersion : this.options.appVersion,
                    language: language[0] || language,
                    deviceString : this.options.clientInfo.getBrowser().name + ' ' + this.options.clientInfo.getBrowser().major + ' | ' + this.options.clientInfo.getOS().name + ' ' + this.options.clientInfo.getOS().version,
                    transport : transport,
                    timeZoneOffset : (d.getTimezoneOffset()/60) * -1
                }),
                contentType: "application/json; charset=utf-8",
                dataType: "json"
            }).done(function( msg ) {
                this._setDeviceToken(uuid);
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

            if (this._getDeviceToken()) {

                if(this.safariPush){

                    $.ajax({
                        type: "DELETE",
                        url: this.options.apiUrl + '/device/' + encodeURIComponent(this._getDeviceToken()),
                        beforeSend: function (xhr) {
                            xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                        }.bind(this)
                    }).done(function( msg ) {
                        this._setDeviceToken("");
                        localStorage.setItem("badge", 0);
                        $(this.element).trigger("notificare:didUpdateBadge", 0);
                        success(msg);
                    }.bind(this))
                        .fail(function(  jqXHR, textStatus, errorThrown ) {
                            errors("Notificare: Failed to delete a UUID");
                        }.bind(this));


                } else {

                    this.serviceWorkerRegistration.pushManager.getSubscription()
                        .then(function(subscription) {
                            if (subscription) {
                                return subscription.unsubscribe();
                            }
                        })
                        .catch(function(error) {
                            this.log('Notificare: Error unsubscribing service worker registration', error);
                        }.bind(this))
                        .then(function() {
                            $.ajax({
                                type: "DELETE",
                                url: this.options.apiUrl + '/device/' + encodeURIComponent(this._getDeviceToken()),
                                beforeSend: function (xhr) {
                                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                                }.bind(this)
                            }).done(function( msg ) {
                                this._setDeviceToken("");
                                localStorage.setItem("badge", 0);
                                $(this.element).trigger("notificare:didUpdateBadge", 0);
                                success(msg);
                            }.bind(this))
                                .fail(function(  jqXHR, textStatus, errorThrown ) {
                                    errors("Notificare: Failed to delete a UUID");
                                }.bind(this));
                        }.bind(this));

                }
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
                    deviceID: this._getDeviceToken()
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
                    this._getNotification(notification);
                }.bind(this), 2000);
            }.bind(this));

        },

        /**
         * Helper method to handle notifications
         */
        handleAction: function(notification, label){
            this._handleActionClickOnWebPushNotification(notification, label);
        },
        /**
         * Handle click of a WebPush Notification
         * @param notification
         * @private
         */
        _handleClickOnWebPushNotification: function(notification){
            var url = this.applicationInfo.websitePushConfig.urlFormatString.replace("%@", notification);
            window.location.replace(url);
            this._onURLLocationChanged();
        },

        /**
         * Handle action click of a Chrome Notification
         * @param notification
         * @private
         */
        _handleActionClickOnWebPushNotification: function(notification, label){

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
                    this._handleActionClickOnWebPushNotification(notification, label);
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
            }.bind(this), function(){
                $(this.element).trigger("notificare:didFailToExecuteAction", msg.notification);
            }.bind(this));
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

            if (this._getDeviceToken()) {
                data.deviceID = this._getDeviceToken();
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
                mimestring;

            if(dataURI.split(',')[0].indexOf('base64') !== -1 ) {
                byteString = atob(dataURI.split(',')[1])
            } else {
                byteString = decodeURI(dataURI.split(',')[1])
            }

            mimestring = dataURI.split(',')[0].split(':')[1].split(';')[0];

            var content = new Array();
            for (var i = 0; i < byteString.length; i++) {
                content[i] = byteString.charCodeAt(i)
            }

            return new Blob([new Uint8Array(content)], {type: mimestring});
        },

        /**
         * Upload a file of type
         * @param file
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
                deviceID: this._getDeviceToken()
            },  function(data){

            }, function(error){

            });

            this.logEvent({
                sessionID: this.uniqueId,
                type: 're.notifica.event.notification.Open',
                notification: msg.notification._id,
                userID: this.options.userId || null,
                deviceID: this._getDeviceToken()
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
                    deviceID: this._getDeviceToken()
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
         * Log a custom event with data
         * @param event
         * @param success
         * @param errors
         */
        logCustomEventWithData: function (event, data, success, errors) {
            $.ajax({
                type: "POST",
                url: this.options.apiUrl + '/event',
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                }.bind(this),
                data: JSON.stringify({
                    sessionID: this.uniqueId,
                    type: 're.notifica.event.custom.' + event,
                    data: data,
                    userID: this.options.userId || null,
                    deviceID: this._getDeviceToken()
                }),
                contentType: "application/json; charset=utf-8",
                dataType: "json"
            }).done(function( msg ) {
                success(msg);
            }.bind(this))
                .fail(function(  jqXHR, textStatus, errorThrown ) {
                    errors('Notificare: Failed to register custom event with data');
                }.bind(this));
        },
        /**
         * Get tags for a device
         * @param success
         * @param errors
         */
        getTags: function (success, errors) {
            if (this._getDeviceToken()) {
                $.ajax({
                    type: "GET",
                    url: this.options.apiUrl + '/device/' + encodeURIComponent(this._getDeviceToken()) + '/tags',
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
            if (this._getDeviceToken()) {
                $.ajax({
                    type: "PUT",
                    url: this.options.apiUrl + '/device/' + encodeURIComponent(this._getDeviceToken()) + '/addtags',
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

            if (this._getDeviceToken()) {
                $.ajax({
                    type: "PUT",
                    url: this.options.apiUrl + '/device/' + encodeURIComponent(this._getDeviceToken()) + '/removetag',
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

            if (this._getDeviceToken()) {
                $.ajax({
                    type: "PUT",
                    url: this.options.apiUrl + '/device/' + encodeURIComponent(this._getDeviceToken()) + '/cleartags',
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
            if (this._getDeviceToken()) {
                $.ajax({
                    type: "GET",
                    url: this.options.apiUrl + '/device/' + encodeURIComponent(this._getDeviceToken()) + '/userdata',
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
            if (this._getDeviceToken()) {
                $.ajax({
                    type: "PUT",
                    url: this.options.apiUrl + '/device/' + encodeURIComponent(this._getDeviceToken()) + '/userdata',
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
            if (this._getDeviceToken()) {
                $.ajax({
                    type: "GET",
                    url: this.options.apiUrl + '/device/' + encodeURIComponent(this._getDeviceToken()) + '/dnd',
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

            if (this._getDeviceToken()) {

                if (start && end) {
                    $.ajax({
                        type: "PUT",
                        url: this.options.apiUrl + '/device/' + encodeURIComponent(this._getDeviceToken()) + '/dnd',
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
            if (this._getDeviceToken()) {
                $.ajax({
                    type: "PUT",
                    url: this.options.apiUrl + '/device/' + encodeURIComponent(this._getDeviceToken()) + '/cleardnd',
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
         * Helper method to check if location is allowed
         */
        isLocationAllowed: function(){
            return localStorage.getItem("isLocationAllowed");
        },
        /**
         * Start Location Updates
         */
        startLocationUpdates: function (success, errors) {

            if (this._getDeviceToken()) {

                if (this.applicationInfo.services && this.applicationInfo.services.locationServices) {

                    if (navigator.geolocation) {
                        this.navigatorWatchPosition = navigator.geolocation.watchPosition(function(position){

                            localStorage.setItem("isLocationAllowed", 1);

                            var cachedPosition = JSON.parse(localStorage.getItem("position"));

                            if(!cachedPosition || cachedPosition.latitude != position.coords.latitude || cachedPosition.longitude != position.coords.longitude){

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

                            localStorage.setItem("isLocationAllowed", 0);

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
                    navigator.geolocation.clearWatch(this.navigatorWatchPosition);
                    localStorage.setItem("isLocationAllowed", 0);
                    this.updateLocation({
                        coords: {
                            latitude: null,
                            longitude: null
                        }
                    }, null, function(data){
                        localStorage.setItem("position", null);
                        this.log("Notificare: Location cleared successfully");
                    }.bind(this), function(){
                        this.log("Notificare: Failed to clear location");
                    });

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
                url: this.options.apiUrl + '/device/' + encodeURIComponent(this._getDeviceToken()),
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
            if (this._getDeviceToken()) {
                $.ajax({
                    type: "GET",
                    url: this.options.apiUrl + '/notification/inbox/fordevice/' + encodeURIComponent(this._getDeviceToken()),
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
         * Get the inbox for a specific device
         * @param success
         * @param errors
         */
        fetchInboxWithParameters: function (since, skip, limit, success, errors) {
            if (this._getDeviceToken()) {
                $.ajax({
                    type: "GET",
                    url: this.options.apiUrl + '/notification/inbox/fordevice/' + encodeURIComponent(this._getDeviceToken()),
                    data: {
                        since: since,
                        skip: skip,
                        limit: limit
                    },
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this)
                }).done(function( msg ) {
                    success(msg);
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
                deviceID: this._getDeviceToken()
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
            if (this._getDeviceToken()) {
                $.ajax({
                    type: "DELETE",
                    url: this.options.apiUrl + '/notification/inbox/fordevice/' + encodeURIComponent(this._getDeviceToken()),
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
            if (this._getDeviceToken()) {
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
         * Refresh Badge
         * @private
         */
        _refreshBadge: function () {

            if (this._getDeviceToken()) {
                $.ajax({
                    type: "GET",
                    url: this.options.apiUrl + '/notification/inbox/fordevice/' + encodeURIComponent(this._getDeviceToken()),
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

        /**
         * Handle Regions
         * @param position
         * @param regions
         * @private
         */
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
            var R = 6371000; // meters
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

            if (this._getDeviceToken()) {
                $.ajax({
                    type: "POST",
                    url: this.options.apiUrl + '/reply',
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this),
                    data: JSON.stringify({
                        userID: this.options.userId,
                        deviceID: this._getDeviceToken(),
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
                            url: (asset.key) ? this.options.assetsUrl + asset.key : null,
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

        /**
         * Handle Geo-Trigger
         * @param type
         * @param region
         * @param success
         * @param errors
         * @private
         */
        _trigger: function (type, region, success, errors) {

            $.ajax({
                type: "POST",
                url: this.options.apiUrl + '/trigger/' + type,
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                }.bind(this),
                data: JSON.stringify({
                    region: region._id,
                    deviceID: this._getDeviceToken()
                }),
                contentType: "application/json; charset=utf-8",
                dataType: "json"
            }).done(function (msg) {
                success(msg);
            }.bind(this))
                .fail(function(  jqXHR, textStatus, errorThrown ) {
                    errors('Notificare: Failed to trigger region');
                }.bind(this));

        },

        /**
         * Perform Cloud API requests
         * @param type
         * @param region
         * @param success
         * @param errors
         * @private
         */
        performCloudAPIRequest: function (verb, path, params, success, errors) {

            if (verb === 'GET') {

                $.ajax({
                    type: 'GET',
                    url: this.options.apiUrl + path,
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this),
                    data: params
                }).done(function (msg) {
                    success(msg);
                }.bind(this))
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
                        errors(jqXHR, textStatus, errorThrown);
                    }.bind(this));

            } else if (verb === 'POST' || verb === 'PUT') {

                $.ajax({
                    type: verb,
                    url: this.options.apiUrl + path,
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this),
                    data: JSON.stringify(params),
                    contentType: "application/json; charset=utf-8",
                    dataType: "json"
                }).done(function (msg) {
                    success(msg);
                }.bind(this))
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
                        errors(jqXHR, textStatus, errorThrown);
                    }.bind(this));

            } else if (verb === 'DELETE') {

                $.ajax({
                    type: verb,
                    url: this.options.apiUrl + path,
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", "Basic " + btoa(this.options.appKey + ":" + this.options.appSecret));
                    }.bind(this)
                }).done(function (msg) {
                    success(msg);
                }.bind(this))
                    .fail(function(  jqXHR, textStatus, errorThrown ) {
                        errors(jqXHR, textStatus, errorThrown);
                    }.bind(this));

            }


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