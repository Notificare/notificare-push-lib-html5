/*
 *  Push Worker for Google Chrome
 *  http://notifica.re
 *
 *  @author Joel Oliveira joel@notifica.re
 *  copyright 2015 Notificare
 */


self.addEventListener('push', function (event) {

    event.waitUntil(

        fetch('/config.json').then(function(response) {
            return response.json();
        }).then(function(config) {
            fetch(config.apiUrl + '/application/info', {
                headers: new Headers({
                    "Authorization": "Basic " + btoa(config.appKey + ":" + config.appSecret)
                })
            }).then(function(response) {
                return response.json();
            }).then(function(info) {

                var application = info.application;

                self.registration.pushManager.getSubscription().then(function(data){

                    fetch(config.apiUrl + '/notification/inbox/fordevice/' + data.endpoint.split('/').pop() + '?skip=0&limit=1',{
                        headers: new Headers({
                            "Authorization": "Basic " + btoa(config.appKey + ":" + config.appSecret)
                        })
                    }).then(function(response) {

                        // Examine the text in the response
                        return response.json().then(function(data) {

                            if(data && data.inboxItems && data.inboxItems.length > 0){
                                var title = application.name;
                                var message = data.inboxItems[0].message;
                                var icon = config.awsStorage + application.websitePushConfig.icon;
                                var notificationTag = data.inboxItems[0].notification;

                                self.clients.matchAll().then(function(clients) {
                                    clients.forEach(function(client) {
                                        client.postMessage('notificationreceived:' + data.inboxItems[0].notification);
                                    });
                                });

                                return self.registration.showNotification(title, {
                                    body: message,
                                    icon: icon,
                                    tag: notificationTag
                                });
                            }

                            return null;
                        });
                    }).catch(function(err) {
                        console.log('Notificare: Failed to fetch message', err);
                        return null;
                    })
                }).catch(function(e){
                    console.log('Notificare: Failed to get subscription', e);
                    return null;
                })

            }).catch(function(e){
                console.log('Notificare: Failed to get application info', e);
                return null;
            })

        }).catch(function(){
            console.log('Notificare: Failed to get config.js', e);
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

            fetch('/config.json').then(function(response) {
                return response.json();
            }).then(function(config) {
                fetch(config.apiUrl + '/application/info', {
                    headers: new Headers({
                        "Authorization": "Basic " + btoa(config.appKey + ":" + config.appSecret)
                    })
                }).then(function(response) {
                    return response.json();
                }).then(function(info) {
                    console.log(clientList);
                    clientList.forEach(function(client) {
                        console.log(client);
                        if(event.notification.tag != 'user_visible_auto_notification'){

                            if (client  && client.url == config.appHost + '/' && 'focus' in client){
                                client.postMessage('notificationclick:' + event.notification.tag);
                                return client.focus();
                            }
                        }
                    });

                    if (clientList.length == 0) {
                        var url = info.websitePushConfig.urlFormatString.replace("%@", event.notification.tag);
                        return clients.openWindow(url);
                    }

                }).catch(function(e){
                    console.log('Notificare: Failed to get application info', e);
                    return null;
                })

            }).catch(function(){
                console.log('Notificare: Failed to get config.js', e);
                return null;
            })

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

            break;
        case 'update':
            //
            break;
        default:
            console.log(e);
        break;
    }
});