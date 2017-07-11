Upgrade
=======

## Upgrade from 1.6.x to 1.7.0

### Changes to options

This new release requires you to a new file called config.js in the root of your web app.

Remove the object required as options of the plugin in older versions:

```javascript

    var options = {
        appVersion: '1.0',
        appKey: 'xxx',
        appSecret: 'xxx',
        allowSilent: true,
        soundsDir: '/resources/sounds/',
        geolocationOptions: {
            timeout: 60000,
            enableHighAccuracy: true,
            maximumAge: Infinity
        }
    };

```

Add the following inside config.json in the root of your web server:

```json

    {
      "apiUrl": "https://cloud.notifica.re/api",
      "awsStorage": "https://s3-eu-west-1.amazonaws.com/notificare-storage",
      "appHost": "http://localhost:3333",
      "appVersion": "1.0",
      "appKey": "YOUR_APP_KEY_HERE",
      "appSecret": "YOUR_APP_SECRET_HERE",
      "allowSilent": true,
      "soundsDir": "/resources/sounds/",
      "serviceWorker": "push-worker-old.js",
      "serviceWorkerScope": "./",
      "geolocationOptions": {
        "timeout": 60000,
        "enableHighAccuracy": true,
        "maximumAge": 100000
      }
    }
    
```

For Chrome notifications, please also add the included push-worker-old.js file in the same level as your index file.
This will make sure your web app is able to receive notifications in Chrome even when users are not at your website.

In this version we've added inbox capabilities, after a successful device registration, you can safely retrieve the list of messages, as follows:

```javascript

    var instance = $('#myapp').notificare();

    ...more code

    $("#myapp").bind("notificare:didRegisterDevice", function(event, data) {

        instance.notificare("fetchInbox", function(inboxItems){

            //inboxItems will be an array
            $.each( inboxItems, function( key, value ) {

                console.log(key, value);

            });

        }, function(error){
            console.log(error);
        });

    });


```

Every time you initiate the plugin and after any change in the number of read items in the inbox, the following event will be triggered:

```javascript

    $("#myapp").bind("notificare:didUpdateBadge", function(event, data) {

        console.log(data);

    });

```

From this list of messages you can retrieve the full inbox item object by invoking the following method:

```javascript

    instance.notificare("openInboxItem", inboxItem);

```

This will trigger the event notificare:didOpenNotification with the full object, as follows:

```javascript

    $("#myapp").bind("notificare:didOpenNotification", function(event, data) {

        console.log(data);

    });

```

You can also remove an item from the inbox by invoking the following method:

```javascript

    instance.notificare("removeFromInbox", inboxItem, function(msg){

        //Message is removed

    }, function(error){
        console.log(error);
    });

```

You can also delete all items in the inbox, as follows:

```javascript

    instance.notificare("clearInbox", function(msg){

        //Inbox is clean

    }, function(error){
        console.log(error);
    });

```

Additionally you can also mark a message as read by invoking the following method:

```javascript

    instance.notificare("markAsRead", inboxItem, function(msg){

        //Item marked as read

    }, function(error){
        console.log(error);
    });

```