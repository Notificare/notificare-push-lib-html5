/*
 *  Push Worker for Google Chrome
 *  http://notifica.re
 *
 *  @author Joel Oliveira joel@notifica.re
 *  copyright 2015 Notificare
 */

var theConfig = null;
var theApplication = null;

self.addEventListener('push', function (event) {

    event.waitUntil(

        fetch('/config.json').then(function(response) {
            return response.json();
        }).then(function(config) {

            if(config.useTestEnv){
                config.apiUrl = "https://cloud-test.notifica.re/api";
                config.awsStorage = "https://push-test.notifica.re/upload";
            } else {
                config.apiUrl = "https://cloud.notifica.re/api";
                config.awsStorage = "https://push.notifica.re/upload";
            }

            theConfig = config;

            fetch(config.apiUrl + '/application/info', {
                headers: new Headers({
                    "Authorization": "Basic " + btoa(config.appKey + ":" + config.appSecret)
                })
            }).then(function(response) {
                return response.json();
            }).then(function(info) {

                var application = info.application;
                theApplication = application;

                self.registration.pushManager.getSubscription().then(function(data){

                    fetch(config.apiUrl + '/notification/inbox/fordevice/' + getPushToken(data) + '?skip=0&limit=1',{
                        headers: new Headers({
                            "Authorization": "Basic " + btoa(config.appKey + ":" + config.appSecret)
                        })
                    }).then(function(response) {
                        return response.json();
                    }).then(function(data) {

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
                        } else {
                            return null;
                        }
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

        self.clients.matchAll({
            type: "window"
        })
        .then(function(clientList) {

            clientList.forEach(function(client) {

                if(event.notification.tag != 'user_visible_auto_notification'){
                    if (client  && client.url == theConfig.appHost + '/' && 'focus' in client){
                        client.postMessage('notificationclick:' + event.notification.tag);
                        return client.focus();
                    }
                }
            });

            if (clientList.length == 0) {
                var url = theApplication.websitePushConfig.urlFormatString.replace("%@", event.notification.tag);
                return clients.openWindow(url);
            }

        })


    );
});

//Set the callback for the activate step
self.addEventListener('activate', function (event) {
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
    event.waitUntil(self.skipWaiting());
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

/**
 * Handles Device Token
 * @param deviceToken
 * @returns {string}
 */
function getPushToken(deviceToken) {
    var pushToken = '';
    if (deviceToken.subscriptionId) {
        pushToken = deviceToken.subscriptionId;
    }
    else {
        pushToken = deviceToken.endpoint.split('/').pop();
    }
    return pushToken;
}