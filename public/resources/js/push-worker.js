/*
 *  Push Worker for Google Chrome
 *  http://notifica.re
 *
 *  @author Joel Oliveira joel@notifica.re
 *  copyright 2015 Notificare
 */


self.addEventListener('push', function (event) {

    console.log(event);
    //event.waitUntil(
    //    fetch(options.apiUrl + '/notification/inbox/fordevice/' + _getCookie('uuid'),{
    //        headers: new Headers({
    //            "Authorization": "Basic " + btoa(options.appKey + ":" + options.appSecret)
    //        })
    //    }).then(function(response) {
    //        if (response.status !== 200) {
    //            // Either show a message to the user explaining the error
    //            // or enter a generic message and handle the
    //            // onnotificationclick event to direct the user to a web page
    //            console.log('Looks like there was a problem. Status Code: ' + response.status);
    //            throw new Error();
    //        }
    //
    //        // Examine the text in the response
    //        return response.json().then(function(data) {
    //
    //            var title = 'Notificare';
    //            var message = data.inboxItems[0].message;
    //            var icon = '/favicon.ico';
    //            var notificationTag = data.inboxItems[0]._id;
    //
    //            return self.registration.showNotification(title, {
    //                body: message,
    //                icon: icon,
    //                tag: notificationTag
    //            });
    //        });
    //    }).catch(function(err) {
    //        console.error('Unable to retrieve data', err);
    //
    //        var title = 'An error occurred';
    //        var message = 'We were unable to get the information for this push message';
    //        var icon = '/favicon.ico';
    //        var notificationTag = 'notification-error';
    //        return self.registration.showNotification(title, {
    //            body: message,
    //            icon: icon,
    //            tag: notificationTag
    //        });
    //    })
    //);
    var title = 'An error occurred';
    var message = 'We were unable to get the information for this push message';
    var icon = '/favicon.ico';
    var notificationTag = 'notification-error';
    return self.registration.showNotification(title, {
        body: message,
        icon: icon,
        tag: notificationTag
    });

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