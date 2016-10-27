/*
 *  Push Worker for WebPush
 *  http://notifica.re
 *
 *  @author Joel Oliveira joel@notifica.re
 *  copyright 2015 Notificare
 */

var theConfig = null;
var theApplication = null;

self.addEventListener('push', function (event) {

    event.waitUntil(

        self.registration.pushManager.getSubscription().then(function(deviceSubscription){

            return new Promise(function(resolve, reject){
                var openRequest = indexedDB.open("config_db");

                openRequest.onsuccess = function(e) {
                    var db = e.target.result;
                    var transaction = db.transaction(["config"], "readonly");
                    var objectStore = transaction.objectStore("config");

                    var request = objectStore.get(1);

                    request.onerror = function(event) {
                        reject(event);
                    };

                    request.onsuccess = function(event) {
                        theConfig = request.result;

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
                                            client.postMessage(JSON.stringify({cmd: 'notificationreceive', message: data.inboxItems[0].notification}));
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

                                        resolve(theConfig);

                                    });

                                } else {
                                    reject(null);
                                }
                            }).catch(function(err) {
                                console.log('Notificare: Failed to fetch message', err);
                                reject(err);
                            })

                        }).catch(function(e){
                            console.log('Notificare: Failed to get application info', e);
                            reject(e);
                        })

                    };
                };

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
                                client.postMessage(JSON.stringify({cmd: 'notificationreply', message: event.notification.tag, action: event.action}));
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
                                    client.postMessage(JSON.stringify({cmd: 'notificationreply', message: event.notification.tag, action: event.action}));
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
            client.postMessage(JSON.stringify({cmd: 'activate'}));
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

            persistToDB(data);

            break;
        default:
            console.log(e);
            break;
    }
});

/**
 * Persist config to indexedDB
 * @param data
 */
function persistToDB(data){
    var openRequest = indexedDB.open("config_db");

    openRequest.onupgradeneeded = function(e) {
        var thisDB = e.target.result;

        if(!thisDB.objectStoreNames.contains("config")) {
            thisDB.createObjectStore("config");
        }
    };

    openRequest.onsuccess = function(e) {
        var db = e.target.result;
        var transaction = db.transaction(["config"],"readwrite");
        var store = transaction.objectStore("config");

        var request = store.get(1);

        request.onerror = function(event) {

            var request = store.add(data.options, 1);
            request.onerror = function(e) {
                console.log(e);
            };

            request.onsuccess = function(e) {
                console.log("Notificare: Configuration data stored successfully");
            };

        };

        request.onsuccess = function(event) {
            // Delete the specified record out of the object store
            var request = store.delete(1);

            request.onsuccess = function(event) {
                var request = store.add(data.options, 1);
                request.onerror = function(e) {
                    console.log(e);
                };

                request.onsuccess = function(e) {
                    console.log("Notificare: Configuration data stored successfully");
                };
            };
        };

    };

    openRequest.onerror = function(e) {
        console.log(e);
    };
}
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