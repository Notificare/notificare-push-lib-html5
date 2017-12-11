$(document).ready(function(){

    var instance = $('#myapp').notificare();

    $("#myapp").bind("notificare:onReady", function(event, data) {

        if(instance.notificare("isDeviceRegistered")){
            $('#is-registered').show();
            $('#enable-notifications').hide();
            $('#disable-notifications').show();
            instance.notificare("registerForNotifications");
        } else {
            $('#is-registered').hide();
            $('#enable-notifications').show();
            $('#disable-notifications').hide();
        }

        $('#visible-ui').show();

        instance.notificare("fetchAssets", "test", function(assets){
            console.log(assets);
        }, function(error){
            console.log(error);
        });

        instance.notificare("performCloudAPIRequest", 'GET', '/region', null, function(data){

            console.log(data);

        }, function(error){
            console.log(error);
        });
        /*
         instance.notificare("fetchUserData", function(userData){
         console.log(userData);
         }, function(error){
         console.log(error);
         });

         instance.notificare("updateUserData", {
         firstName: "MASSIMO",
         lastName: "GONDOLIERI"
         }, function(msg){
         console.log(msg);
         }, function(error){
         console.log(error);
         });
         */

        /*
         instance.notificare("fetchDoNotDisturb", function(dnd){
         console.log(dnd);
         }, function(error){
         console.log(error);
         });
         */

        /*
         instance.notificare("updateDoNotDisturb", "01:00" , "07:00" , function(msg){
         console.log(msg);
         }, function(error){
         console.log(error);
         });

         instance.notificare("clearDoNotDisturb" , function(msg){
         console.log(msg);
         }, function(error){
         console.log(error);
         });
         */

    });

    $("#myapp").bind("notificare:didReceiveDeviceToken", function(event, data) {
        //instance.notificare("userId","userID");
        //instance.notificare("username","userName");
        instance.notificare("registerDevice",data);
    });

    $("#myapp").bind("notificare:didFailToReceiveDeviceToken", function(event, data) {
        instance.notificare("log", 'didFailToReceiveDeviceToken: ' + data);
    });

    $("#myapp").bind("notificare:didRegisterDevice", function(event, data) {
        //Here it's safe to register tags

        $('#is-registered').show();
        $('#enable-notifications').hide();
        $('#disable-notifications').show();

        instance.notificare("getTags", function(tags){
            //console.log(tags);
        }, function(error){
            console.log(error);
        });

        instance.notificare("startLocationUpdates", function(data){
            console.log(data);
        }, function(error){
            console.log(error);
        });

        instance.notificare("fetchInbox", function(inboxItems){

            refreshInbox(inboxItems);

        }, function(error){
            console.log(error);
        });

    });

    $("#myapp").bind("notificare:didFailToRegisterDevice", function(event, data) {
        instance.notificare("registerDevice", data);


    });

    $("#myapp").bind("notificare:didReceiveNotification", function(event, data) {

        instance.notificare("fetchInbox", function(inboxItems){

            refreshInbox(inboxItems);

        }, function(error){
            console.log(error);
        });
    });

    $("#myapp").bind("notificare:didOpenNotification", function(event, data) {

        // Handle all types accordingly
        alert(data.message);


        instance.notificare("fetchInbox", function(inboxItems){

            refreshInbox(inboxItems);

        }, function(error){
            console.log(error);
        });

    });

    $("#myapp").bind("notificare:didUpdateBadge", function(event, data) {
        instance.notificare("log", 'didUpdateBadge: ' + data);
        if (data > 0) {
            $("#badge").text(data);
            $("#badge").show();
        } else {
            $("#badge").hide();
        }

        instance.notificare("fetchInbox", function(inboxItems){

            refreshInbox(inboxItems);

        }, function(error){
            console.log(error);
        });

    });

    $("#myapp").bind("notificare:willExecuteAction", function(event, data) {
        instance.notificare("log", 'willExecuteAction: ' + data);
    });

    $("#myapp").bind("notificare:shouldPerformActionWithURL", function(event, data) {
        instance.notificare("log", 'shouldPerformActionWithURL: ' + data);
    });

    $("#myapp").bind("notificare:didFailToExecuteAction", function(event, data) {
        instance.notificare("log", 'didFailToExecuteAction: ' + data);
    });

    $("#myapp").bind("notificare:didExecuteAction", function(event, data) {
        instance.notificare("log", 'didExecuteAction: ' + data);
    });

    $("#myapp").bind("notificare:didNotExecuteAction", function(event, data) {
        instance.notificare("log", 'didNotExecuteAction: ' + data);
    });

    $("#myapp").bind("notificare:didReceiveSystemNotification", function(event, data) {
        instance.notificare("log", 'didReceiveSystemNotification: ' + data);
    });
    /**
     * Example methods
     */

    function refreshInbox(inboxItems){

        $("#inbox-list").empty();

        $.each( inboxItems.reverse(), function( key, value ) {
            if (value.opened) {
                $("#inbox-list").prepend('<li><a href="' + value._id + '" class="remove-from-inbox"><span class="glyphicon glyphicon-remove"></span></a><a class="open-inbox-message" href="' + value.notification + '">' + value.message + '</a></li>');
            } else {
                $("#inbox-list").prepend('<li><a href="' + value._id + '" class="remove-from-inbox"><span class="glyphicon glyphicon-remove"></span></a><a class="open-inbox-message" href="' + value.notification + '"><strong>' + value.message + '</strong></a></li>');
            }

        });
    }

    $("#clear-inbox").click(function(){
        instance.notificare("clearInbox", function(msg){
            instance.notificare("fetchInbox", function(inboxItems){

                refreshInbox(inboxItems);

            }, function(error){
                console.log(error);
            });
        }, function(error){
            console.log(error);
        });
    }.bind(this));


    $(document).on('click', '.open-inbox-message', function (){
        instance.notificare("openInboxItem", {notification: $(this).attr('href')});

        setTimeout(function(){
            instance.notificare("fetchInbox", function(inboxItems){

                refreshInbox(inboxItems);

            }, function(error){
                console.log(error);
            });
        }, 1000);

        return false;
    });


    $(document).on('click', '.remove-from-inbox', function (){

        instance.notificare("removeFromInbox", {_id: $(this).attr('href')}, function(msg){

            instance.notificare("fetchInbox", function(inboxItems){

                refreshInbox(inboxItems);

            }, function(error){
                console.log(error);
            });

        }, function(error){
            console.log(error);
        });

        return false;
    });



    $(document).on('click', '#enable-notifications', function (){

        instance.notificare("registerForNotifications");

        return false;
    });

    $(document).on('click', '#disable-notifications', function (){

        instance.notificare("unregisterDevice", function(msg){
            $('#is-registered').hide();
            $('#enable-notifications').show();
            $('#disable-notifications').hide();
        }, function(errors){

        });

        return false;
    });

});