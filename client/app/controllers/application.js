MyApp.ApplicationController = Ember.Controller.extend({
    /**
     * Start here
     */
	start: function() {

        var options = {
            appName: 'Notificare HTML5 JS SDK',
            nativeNotifications: true,
            appVersion: '1.0',
            appKey: '1798db7916a4cf53bea00499d6d0b15ca5c8554e25c4fe56cfaea1b9b937764f',
            pushId: 'web.re.notifica.html5sdk',
            userID: null,
            username: null
        };

        $('#myapp').notificare(options);

        $("#notificare").bind("notificare:willOpenNotification", function(event, data) {
            //console.log(event, data);
        });

        $("#notificare").bind("notificare:didOpenNotification", function(event, data) {
            //console.log(event, data);
        });

        $("#notificare").bind("notificare:didFailToOpenNotification", function(event, data) {
            //console.log(event, data);
        });

        $("#notificare").bind("notificare:didConnectToWebSocket", function(event) {
            //console.log(event);
        });

        $("#notificare").bind("notificare:didRegisterWebSocket", function(event, data) {
            //console.log(event,data);
        });

        $("#notificare").bind("notificare:didGetWebSocketError", function(event) {
            this.start();
        }.bind(this));

        $("#notificare").bind("notificare:didCloseWebSocket", function(event) {
            this.start();
        });
    }

}); 
