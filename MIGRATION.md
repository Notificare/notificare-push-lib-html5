# Migration

If you are migrating from 1.x.x version of our SDK, there are several breaking changes that you will need to take into consideration. A considerable part of the API in version 1 was removed and replaced with a simplified new API that unifies integration of remote notifications, location services, user authentication, contextual content and analytics in Chrome (Desktop & Mobile), Firefox (Desktop & Mobile), Opera (Desktop & Mobile) and Safari (Desktop). We've also dropped jQuery and UAParser.js as a dependencies so you no longer need to include them.

In 2.0, you should initialize the library by invoking the following method:

```
const notificare = new Notificare();
```

Also note that we've replaced all event listeners with callback methods, as follows:

```
notificare.onReady = (application) => {

}
```

And all methods that implemented success and error callback functions, now use Promises:

```
notificare.inboxManager.fetchInbox().then((response) => {
    //Handle success
}).catch((e) => {
    //Handle error
});
```

Guides for setup and implementation can be found here:

https://docs.notifica.re/sdk/v2/html5/setup/


## Device Registration

When you are migrating from older versions, you will notice that you no longer need to take action whenever a device token is registered, as device registration in SDK 2.0 is totally managed by Notificare. You can still register/unregister a device to/from a userID and userName and Notifcare will always keep that information cached in the device. This will make sure that whenever a device token changes everything is correctly handled without the need for your app to handle it.

It is also important to mention that the first time an app is launched we will assign a UUID token to the device before you even request to register for notifications. Basically with this new SDK all features of Notificare can still be used even if your app does not implement remote notifications. Obviously if you never request to register for notifications, users will never receive remote notifications, although messages will still be in the inbox (if implemented), tags can be registered, location services can be used and pretty much all features will work as expected.

Once you decide to register for notifications, those automatically assigned device tokens will be replaced by the Web Push (Chrome, Firefox, Opera) or Website Push (Safari) tokens assigned to each device.

Bottom line, for this version you should remove all the device registration methods used in previous versions and optionally you can implement the new callback method which is merely informative. You can find more information about device registration here:

https://docs.notifica.re/sdk/v2/html5/implementation/register/

## Remote Notifications

In SDK 2.0, we've unified notification handling to work as one for all versions and browsers. We've also simplified the implementation of this functionality by allowing you to take actions whenever the **didOpenNotification** is triggered. Actionable notification are also totally managed by Notificare and you will not have to take care of anything to handle actions.

Basically for this version you should replace the notification event listeners implemented for previous versions and implement only the following callback method:

```
notificare.didOpenNotification = (notification) => {
    //Handle Notification
}
```

Another important thing to acknowledge for this new version is the fact that we've unified the local and remote message inbox under a new class, called inboxManager. You will need to change your current inbox implementation to reflect these changes in order to benefit from a super optimised cached version of your messages.

More in-depth guides can be found here:

https://docs.notifica.re/sdk/v2/html5/implementation/push/

## Location Services

In this new version, locations services do not suffer any significant API change. Most of the changes to this functionality are under-the-hood and implementation for previous versions will work in this new versions.

For more information, please read the guides for this functionality located here:

https://docs.notifica.re/sdk/v2/html5/implementation/location-services/

## Tags

This functionality remains pretty much the same in this new version. We did add two new methods that you might find interesting when implementing tags.

You can now add a single tag using the following method:

```
notificare.inboxManager.addTag("tag_press").then((response) => {
    //Handle success
}).catch((e) => {
    //Handle error
});
```

And you can remove several tags with one single request by using the method below:

```
notificare.inboxManager.removeTags(["tag_press", "tag_events"]).then((response) => {
    //Handle success
}).catch((e) => {
    //Handle error
});
```

You can find more information in our guides located here:

https://docs.notifica.re/sdk/v2/html5/implementation/tags/

## Loyalty

This functionality did not suffer any change in SDK 2.0 and you will not need to change anything in your current implementation.

More in-depth information can be found in our guides located here:

https://docs.notifica.re/sdk/v2/html5/implementation/loyalty/implementation/

## Analytics

This functionality did not suffer any change in SDK 2.0 and you will not need to change anything in your current implementation.

More in-depth information can be found in our guides located here:

https://docs.notifica.re/sdk/v2/html5/implementation/analytics/

## Storage

This functionality did not suffer any change in SDK 2.0 and you will not need to change anything in your current implementation.

More in-depth information can be found in our guides located here:

https://docs.notifica.re/sdk/v2/html5/implementation/storage/

## Scannables

We've included an helper method in SDk 2.0 for Scannables. In order to make it easier for you to handle the content from a NFC tag or QR Code, we've added the following method:

```
notificare.fetchScannable(code).then((response) => {
    //Handle success
}).catch((e) => {
    //Handle error
});
```

Please find all the information about this functionality here:

https://docs.notifica.re/sdk/v2/html5/implementation/scannables/