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
            sdkVersion: '1.1.0',
            apiUrl: "/api",
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

            this.placeholder = $(document.createElement('div'));
            this.placeholder.addClass('notificare');
            this.uniqueId = this.getUniqueID();
            this.sessionDate = new Date();
            this.reconnectTimeout = 0;
            this.minReconnectTimeout = 1000;
            this.maxReconnectTimeout = 60000;

            var _this = this;

            this.logEvent({
                sessionID: this.uniqueId,
                type: 're.notifica.event.application.Open'
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
                });

                return 'Leaving this page will prevent notifications from being received.';
            };

            if (this.options.nativeNotifications) {
                if (window.Notification) {
                    this.log('Notificare: Notification is supported');

                    if (Notification.permission === 'default') {
                        this.log('Notificare: Native notifications requested to the user');

                        $('#modal-simple-auth').modal('show');

                        $('#accept-notifications').click(function (e) {
                            Notification.requestPermission(function () {
                                $('#modal-simple-auth').modal('hide');
                                _this.log('Notificare: Native notifications accepted by the user');
                                _this.setSocket();
                            });
                        });


                    } else if (Notification.permission === 'granted') {
                        this.log('Notificare: Native notifications granted by the user');
                        this.setSocket();
                    } else if (Notification.permission === 'denied') {
                        this.log('Notificare: Native notifications denied by the user');
                    } else {
                        this.log('Notificare: Native notifications unknown permission');
                    }

                }else if (window.webkitNotifications) {
                    this.log('Notificare: webkitNotifications is supported');

                    if (window.webkitNotifications.checkPermission() == 0) {
                        this.setSocket();
                    }else{
                        $('#modal-simple-auth').modal('show');
                        var _this = this;
                        $('#accept-notifications').click(function(e) {
                            e.preventDefault();
                            $('#modal-simple-auth').modal('hide');
                            window.webkitNotifications.requestPermission(function(e){
                                _this.setSocket();
                            });

                        });
                    }
                }else if (navigatior.mozNotification) {
                    this.log('Notificare: webkitNotifications is supported');

                    if (navigatior.mozNotification.checkPermission() == 0) {
                        this.setSocket();
                    }else{
                        $('#modal-simple-auth').modal('show');
                        var _this = this;
                        $('#accept-notifications').click(function(e) {
                            e.preventDefault();
                            $('#modal-simple-auth').modal('hide');
                            navigatior.mozNotification.requestPermission(function(e){
                                _this.setSocket();
                            });

                        });
                    }
                } else {
                    this.log('Notificare: Native notifications are not supported, falling back to UI only');
                    this.setSocket();
                }

            } else {
                this.log('Notificare: Using UI only');
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
                            _this.logEvent({
                                sessionID: this.uniqueId,
                                type: 're.notifica.event.application.Install'
                            });
                        } else if (data.notification) {
                            _this.getNotification(data.notification);
                        }
                    }
                }

                //On ERROR
                connection.onerror = function (e) {
                    $(_this.element).trigger("notificare:didGetWebSocketError");
                };

                //On CLOSE
                connection.onclose = function (e) {
                    $(_this.element).trigger("notificare:didCloseWebSocket");
                };

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
                url: this.options.apiUrl + '/devices',
                data: {
                    auth_token: this.options.token,
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
                dataType: 'json'
            }).done(function( msg ) {
                _this.log('Notificare: Device Registered');
            }).fail(function( msg ) {
                _this.log('Notificare: Failed to register device');
            });
        },
        /**
         *
         */
        getNotification: function (notification) {

            var _this = this;
            $.ajax({
                type: "GET",
                url: this.options.apiUrl + '/notifications/' + notification.id
            }).done(function( msg ) {
                $(_this.element).trigger("notificare:willOpenNotification", notification.id);
                _this.showNotification(msg);
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

            this.log({
                sessionID: this.uniqueId,
                type: 're.notifica.event.notification.Influenced',
                notification: msg.notification.id,
                userID: this.options.userID,
                deviceID: this.getCookie('uuid')
            });

            this.log({
                sessionID: this.uniqueId,
                type: 're.notifica.event.notification.Open',
                notification: msg.notification.id,
                userID: this.options.userID,
                deviceID: this.getCookie('uuid')
            });

            if(this.options.nativeNotifications) {
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
                        this.close();
                    };

                } else if ("webkitNotifications" in window) {
                    this.notification = window.webkitNotifications.createNotification('/favicon.ico', this.options.appName, msg.notification.message);
                    this.notification.show();

                } else if ("mozNotification" in navigator) {
                    this.notification = navigator.mozNotification.createNotification(this.options.appName, msg.notification.message, '/favicon.ico');
                    this.notification.show();
                }
            } else {
                $('#modal-simple-message').modal('show');
                $('#modal-simple-message .modal-body').html(msg.notification.message);
            }

        },
        /**
         *
         */
        logEvent: function (data) {
            $.ajax({
                type: "POST",
                url: this.options.apiUrl + '/events',
                data: data,
                dataType: 'json'
            }).done(function( msg ) {
                this.log('Notificare: Log Registered');
            }.bind(this))
                .fail(function( msg ) {
                    this.log('Notificare: Failed to register log');
                }.bind(this));
        },
        /**
         *
         */
        getTags: function () {
            if (this.getCookie('uuid')) {
                $.ajax({
                    type: "GET",
                    url: this.options.apiUrl + '/devices/' + this.getCookie('uuid') + '/tags'
                }).done(function( msg ) {
                    this.log('Notificare: Tags' + msg.tags);
                }.bind(this))
                .fail(function( msg ) {
                    this.log('Notificare: Failed to get tags' + msg);
                }.bind(this));
            } else {
                this.log('Notificare: Calling get tags before having a deviceId');
            }
        },
        /**
         *
         */
        addTags: function (data) {
            if (this.getCookie('uuid')) {
                $.ajax({
                    type: "PUT",
                    url: this.options.apiUrl + '/devices/' + this.getCookie('uuid') + '/addtags',
                    data: {
                        tags: data
                    },
                    dataType: 'json'
                }).done(function( msg ) {
                    this.log('Notificare: Tag Registered' + msg);
                }.bind(this))
                .fail(function( msg ) {
                    this.log('Notificare: Failed to register tag' + msg);
                }.bind(this));
            } else {
                this.log('Notificare: Calling add tags before having a deviceId');
            }
        },
        /**
         *
         */
        removeTag: function (data) {

            if (this.getCookie('uuid')) {
                $.ajax({
                    type: "PUT",
                    url: this.options.apiUrl + '/devices/' + this.getCookie('uuid') + '/removetag',
                    data: {
                        tag: data
                    },
                    dataType: 'json'
                }).done(function( msg ) {
                    this.log('Notificare: Tag removed' + msg);
                }.bind(this))
                .fail(function( msg ) {
                    this.log('Notificare: Failed to remove tag');
                }.bind(this));
            } else {
                this.log('Notificare: Calling remove tag before having a deviceId');
            }
        },
        /**
         *
         */
        clearTags: function () {

            if (this.getCookie('uuid')) {
                $.ajax({
                    type: "PUT",
                    url: this.options.apiUrl + '/devices/' + this.getCookie('uuid') + '/cleartags',
                    data: null,
                    dataType: 'json'
                }).done(function( msg ) {
                    this.log('Notificare: Tags removed' + msg);
                }.bind(this))
                .fail(function( msg ) {
                    this.log('Notificare: Failed to remove tag');
                }.bind(this));
            } else {
                this.log('Notificare: Calling remove tag before having a deviceId');
            }
        },
        /**
         *
         */
        reply: function (notification, data) {
            $.ajax({
                type: "POST",
                url: this.options.apiUrl + '/replies',
                data: {
                    userID: this.options.userID,
                    deviceID: this.getCookie('uuid'),
                    notification: notification,
                    data: data
                },
                dataType: 'json'
            }).done(function( msg ) {
                this.log('Notificare: Reply Registered');
            }.bind(this))
            .fail(function( msg ) {
                this.log('Notificare: Failed to register reply');
            }.bind(this));
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