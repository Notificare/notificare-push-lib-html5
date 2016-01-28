/*
 *  Push Worker for Google Chrome
 *  http://notifica.re
 *
 *  @author Joel Oliveira joel@notifica.re
 *  copyright 2015 Notificare
 */


self.addEventListener('push', function (event) {

    event.waitUntil(

        self.registration.pushManager.getSubscription().then(function(data){

            fetch(config.apiUrl + '/notification/inbox/fordevice/' + data.endpoint.split('/').pop() + '?skip=0&imit=1',{
                headers: new Headers({
                    "Authorization": "Basic " + btoa(config.appKey + ":" + config.appSecret)
                })
            }).then(function(response) {
                if (response.status !== 200) {
                    // Either show a message to the user explaining the error
                    // or enter a generic message and handle the
                    // onnotificationclick event to direct the user to a web page
                    console.log('Looks like there was a problem. Status Code: ' + response.status);
                    throw new Error();
                }

                // Examine the text in the response
                return response.json().then(function(data) {

                    if(data && data.inboxItems && data.inboxItems.length > 0){
                        var title = config.appName;
                        var message = data.inboxItems[0].message;
                        var icon = config.appIcon;
                        var notificationTag = data.inboxItems[0].notification;

                        self.clients.matchAll().then(function(clients) {
                            clients.forEach(function(client) {
                                client.postMessage('notificationreceived:' + data.inboxItems[0].notification);
                            });
                        });

                        console.log(event);
                        return self.registration.showNotification(title, {
                            body: message,
                            icon: icon,
                            tag: notificationTag
                        });
                    }

                    return null;
                });
            }).catch(function(err) {
                console.log('Failed to fetch message', err);
                return null;
            })
        }).catch(function(e){
            console.log('Failed to get subscription', e);
            return null;
        })
    );
});


self.addEventListener('notificationclick', function (event) {

    event.notification.close();

    event.waitUntil(
        clients.matchAll({
            type: "window"
        })
        .then(function(clientList) {
            clientList.forEach(function(client) {
                if(event.notification.tag != 'user_visible_auto_notification'){

                    if (client  && client.url == config.appHost + '/' && 'focus' in client){
                        client.postMessage('notificationclick:' + event.notification.tag);
                        return client.focus();
                    }
                }
            });

            if (clientList.length == 0) {
                var url = config.urlFormatString.replace("%@", event.notification.tag);
                return clients.openWindow(url);
            }
        })

    );
});

// refresh caches
self.addEventListener('activate', function (event) {
    //console.log(event);
    clients.claim();
    clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
            client.postMessage('workeractivated:');
        });
    });
});

// Set the callback for the install step
self.addEventListener('install', function(event) {
    // Perform install steps
    //console.log(event);
});


self.addEventListener("message", function(e) {

    switch(e.data.action) {
        case 'init':
            //
            config = e.data;
            break;
        case 'update':
            //
            break;
        default:
            console.log(e);
        break;
    }
});