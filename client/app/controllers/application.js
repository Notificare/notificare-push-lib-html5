MyApp.ApplicationController = Ember.Controller.extend({
	start: function() {

        Ember.run.later(this, function(){
            var options = {
                appName: 'Notificare Websockets Demo',
                nativeNotifications: true,
                appVersion: '1.0',
                userID: null,
                username: null
            };


            $('#myapp').notificare(options);

            $("#myapp").bind("notificare:willOpenNotification", function(event, data) {
                console.log(event, data);
            });

            $("#myapp").bind("notificare:didOpenNotification", function(event, data) {
                console.log(event, data);
            });

            $("#myapp").bind("notificare:didFailToOpenNotification", function(event, data) {
                console.log(event, data);
            });

            $("#myapp").bind("notificare:didConnectToWebSocket", function(event) {
                console.log(event);
            });

            $("#myapp").bind("notificare:didRegisterWebSocket", function(event, data) {
                console.log(event,data);
            });

            $("#myapp").bind("notificare:didGetWebSocketError", function(event) {
                console.log(event);

            });

            $("#myapp").bind("notificare:didCloseWebSocket", function(event) {
                console.log(event);

            });
        }, 1000);

    }

}); 
