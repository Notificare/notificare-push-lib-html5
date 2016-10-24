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

    self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
            client.postMessage(JSON.stringify({cmd: 'push'}));
        });
    })

    event.waitUntil(

        self.registration.pushManager.getSubscription().then(function(deviceSubscription){

            return fetch(theConfig.apiUrl + '/application/info', {
                headers: new Headers({
                    "Authorization": "Basic " + btoa(theConfig.appKey + ":" + theConfig.appSecret)
                })
            }).then(function(response) {
                return response.json();
            }).then(function(info) {

                var application = info.application;
                theApplication = application;

                return fetch(theConfig.apiUrl + '/notification/inbox/fordevice/' + getPushToken(deviceSubscription) + '?skip=0&limit=1',{
                    headers: new Headers({
                        "Authorization": "Basic " + btoa(theConfig.appKey + ":" + theConfig.appSecret)
                    })
                }).then(function(response) {
                    return response.json();
                }).then(function(data) {

                    if(data && data.inboxItems && data.inboxItems.length > 0){
                        var title = theApplication.name;
                        var message = data.inboxItems[0].message;
                        var icon = theConfig.awsStorage + theApplication.websitePushConfig.icon;
                        var notificationTag = data.inboxItems[0]._id;

                        self.clients.matchAll().then(function(clients) {
                            clients.forEach(function(client) {
                                client.postMessage(JSON.stringify({cmd: 'notificationreceived', message: data.inboxItems[0].notification}));
                            });
                        });

                        return fetch(theConfig.apiUrl + '/notification/' + data.inboxItems[0].notification ,{
                            headers: new Headers({
                                "Authorization": "Basic " + btoa(theConfig.appKey + ":" + theConfig.appSecret)
                            })
                        }).then(function(response) {
                            return response.json();
                        }).then(function(data) {

                            var actions = [];
                            data.notification.actions.forEach(function(a){
                                actions.push({
                                    title: a.label,
                                    action: a.label
                                });
                            });
                            return self.registration.showNotification(title, {
                                body: message,
                                icon: icon,
                                tag: notificationTag,
                                actions: actions
                            });
                        });

                    } else {
                        return null;
                    }
                }).catch(function(err) {
                    console.log('Notificare: Failed to fetch message', err);
                    return null;
                })

            }).catch(function(e){
                console.log('Notificare: Failed to get application info', e);
                return null;
            })

        }).catch(function(e){
            console.log('Notificare: Failed to get subscription', e);
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

            if (clientList.length == 0) {

                var url = theConfig.appHost;

                if (event.action) {

                    setTimeout(function(){

                        clients.matchAll().then(function(clients) {
                            clients.forEach(function(client) {
                                client.postMessage(JSON.stringify({cmd: 'notificationreplied', message: event.notification.tag, action: event.action}));
                            });
                        });

                    }, 2000);

                } else {
                    url = theApplication.websitePushConfig.urlFormatString.replace("%@", event.notification.tag);

                }

                return clients.openWindow(url);

            } else {

                clientList.forEach(function(client) {

                    if (client  && client.url.indexOf(theConfig.appHost) > -1 && 'focus' in client){

                        if (event.action) {

                            self.clients.matchAll().then(function(clients) {
                                clients.forEach(function(client) {
                                    client.postMessage(JSON.stringify({cmd: 'notificationreplied', message: event.notification.tag, action: event.action}));
                                });
                            });

                        } else {

                            client.postMessage(JSON.stringify({cmd: 'notificationclick', message: event.notification.tag}));

                        }

                        return client.focus();
                    }
                });

            }

        })

    );

});

//Set the callback for the activate step
self.addEventListener('activate', function (event) {
    clients.claim();
    clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
            client.postMessage(JSON.stringify({cmd: 'workeractivated'}));
        });
    });
});

// Set the callback for the install step
self.addEventListener('install', function(event) {
    // Perform install steps
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("message", function(e) {

    var data = JSON.parse(e.data);

    switch(data.action) {
        case 'init':
            theConfig = data.options;
            break;
        case 'update':
            theConfig = data.options;
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