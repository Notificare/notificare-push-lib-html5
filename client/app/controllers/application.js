MyApp.ApplicationController = Ember.Controller.extend({

    /**
     * Start here
     */
	start: function() {

        var options = {
            appName: 'Notificare Websockets Demo',
            nativeNotifications: true,
            appVersion: '1.0',
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
