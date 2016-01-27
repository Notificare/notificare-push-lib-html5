/*
 *  Push Worker for Google Chrome
 *  http://notifica.re
 *
 *  @author Joel Oliveira joel@notifica.re
 *  copyright 2015 Notificare
 */


self.addEventListener('push', function (event) {

    var options = {
        appName: "HMTL 5 SDK",
        apiUrl: "https://cloud.notifica.re/api",
        appKey: '1798db7916a4cf53bea00499d6d0b15ca5c8554e25c4fe56cfaea1b9b937764f',
        appSecret: '302d94942a158d4d493020e30ab44fa92770d7d41a436e405e85e4509c9ac854'
    };

    event.waitUntil(

        self.registration.pushManager.getSubscription().then(function(data){

            fetch(options.apiUrl + '/notification/inbox/fordevice/' + data.endpoint.split('/').pop(),{
                headers: new Headers({
                    "Authorization": "Basic " + btoa(options.appKey + ":" + options.appSecret)
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
                        var title = 'Notificare';
                        var message = data.inboxItems[0].message;
                        var icon = '/favicon.ico';
                        var notificationTag = data.inboxItems[0]._id;

                        return self.registration.showNotification(title, {
                            body: message,
                            icon: icon,
                            tag: notificationTag
                        });
                    }

                    return null;
                });
            }).catch(function(err) {
                return null;
            })
        }).catch(function(e){
            return null;
        })
    );
});
self.addEventListener('notificationclick', function (event) {
    console.log(event);
    event.notification.close();
});

self.addEventListener('message', function (evt) {
    console.log('postMessage received', evt.data);
});

// refresh caches
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames.map(function (cacheName) {
                    return caches.delete(cacheName);
                })
            );
        })
    );
});

// Set the callback for the install step
self.addEventListener('install', function(event) {
    // Perform install steps
    console.log(event);
});