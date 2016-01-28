Upgrade
=======

## Upgrade from 1.6.x to 1.7.0

### Changes to options

This new release requires you to a new file called config.js in the root of your web app:

Remove the initial object required as options of of the plugin and add the following inside config.json:

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
      "serviceWorker": "push-worker.js",
      "serviceWorkerScope": "./",
      "geolocationOptions": {
        "timeout": 60000,
        "enableHighAccuracy": true,
        "maximumAge": 100000
      }
    }
    
```

For Chrome notifications, please also add the included push-worker.js file in the same level as your index file.
This will make sure your web app is able to receive notifications in Chrome even when users are not at your website.
