MyApp.ApplicationController = Ember.Controller.extend({
    /**
     * Start here
     */
	start: function() {

        var options = {
            appName: 'Notificare HTML5 JS SDK',
            allowSilent: true,
            appVersion: '1.0',
            appKey: '1798db7916a4cf53bea00499d6d0b15ca5c8554e25c4fe56cfaea1b9b937764f',
            pushId: 'web.re.notifica.html5sdk'
        };

        var instance = $('#myapp').notificare(options);

        $("#myapp").bind("notificare:didReceiveDeviceToken", function(event, data) {
            //instance.notificare("userId","userID");
            //instance.notificare("username","userName");
            instance.notificare("registerDevice",data);
        });

        $("#myapp").bind("notificare:didRegisterDevice", function(event, data) {
            //Here it's safe to register tags
            instance.notificare("getTags", function(tags){
                console.log(tags);
            }, function(error){
                console.log(error);
            });
            instance.notificare("startLocationUpdates", function(data){
                console.log(data);
            }, function(error){
                console.log(error);
            });
        });

        $("#myapp").bind("notificare:didFailToRegisterDevice", function(event, data) {
            //instance.notificare("registerDevice",data);
        });

        $("#myapp").bind("notificare:didReceiveNotification", function(event, data) {
            // data will be the minimized notification object
        });

        $("#myapp").bind("notificare:didOpenNotification", function(event, data) {
            // data will be the full notification object
        });
    }

}); 
