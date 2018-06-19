document.addEventListener("DOMContentLoaded", function() {

    var UI_CONSTANTS = {
        demo: document.getElementById("demo"),
        pushToggle: document.getElementById("pushToggle"),
        locationToggle: document.getElementById("locationToggle"),
        tagPressToggle: document.getElementById("tagPressToggle"),
        tagEventsToggle: document.getElementById("tagEventsToggle"),
        tagNewsletterToggle: document.getElementById("tagNewsletterToggle"),
        dndToggle: document.getElementById("dndToggle"),
        dndTimes: document.getElementById("dndTimes"),
        dndStart: document.getElementById("dndStart"),
        dndEnd: document.getElementById("dndEnd"),
        applicationInfo: document.getElementById("applicationInfo"),
        inboxItems: document.getElementById("inboxItems"),
        notificationModal: document.getElementById("notificationModal"),
        notificationModalContent: document.getElementById("notificationModalContent"),
        notificationModalClose: document.getElementById("notificationModalClose"),
        notificationModalContentPlaceholder: document.getElementById("notificationModalContentPlaceholder"),
        notificationModalActionsPlaceholder: document.getElementById("notificationModalActionsPlaceholder"),
        navBar: document.getElementById("navBar"),
        navBarList: document.getElementById("navBarList"),
        inboxArea:  document.getElementById("inboxArea"),
        locationsArea:  document.getElementById("locationsArea"),
        storageArea:  document.getElementById("storageArea"),
        settingsArea:  document.getElementById("settingsArea"),
        map: document.getElementById('map'),
        assetGroups: document.getElementById("assetGroups")
    };

    UI_CONSTANTS.inboxArea.style.display = 'block';
    UI_CONSTANTS.locationsArea.style.display = 'none';
    UI_CONSTANTS.storageArea.style.display = 'none';
    UI_CONSTANTS.settingsArea.style.display = 'none';


    var items = UI_CONSTANTS.navBarList.getElementsByTagName("li");
    for (var i=0; i< items.length; i++){

        items[i].getElementsByTagName("a")[0].addEventListener('click', function(e) {
            e.preventDefault();

            for (var j=0; j< items.length; j++){
                items[j].setAttribute('class', '');
            }

            this.parentNode.setAttribute('class', 'active');

            if (this.getAttribute('rel') === 'inbox') {

                UI_CONSTANTS.inboxArea.style.display = 'block';
                UI_CONSTANTS.locationsArea.style.display = 'none';
                UI_CONSTANTS.storageArea.style.display = 'none';
                UI_CONSTANTS.settingsArea.style.display = 'none';

            } else if (this.getAttribute('rel') === 'locations') {

                UI_CONSTANTS.inboxArea.style.display = 'none';
                UI_CONSTANTS.locationsArea.style.display = 'block';
                UI_CONSTANTS.storageArea.style.display = 'none';
                UI_CONSTANTS.settingsArea.style.display = 'none';

                handleMap();

            } else if (this.getAttribute('rel') === 'events') {

                var event = window.prompt('Register a Custom Event');

                if (event) {
                    notificare.logCustomEvent(event, null).then((response) => {
                        console.log(response);
                    });
                }

            } else if (this.getAttribute('rel') === 'storage') {

                UI_CONSTANTS.inboxArea.style.display = 'none';
                UI_CONSTANTS.locationsArea.style.display = 'none';
                UI_CONSTANTS.storageArea.style.display = 'block';
                UI_CONSTANTS.settingsArea.style.display = 'none';

                var assetGroup = window.prompt('Search for Asset Groups');

                if (assetGroup) {
                    notificare.fetchAssets(assetGroup).then((response) => {
                        handleAssets(response);
                    });
                }

            } else if (this.getAttribute('rel') === 'settings') {

                UI_CONSTANTS.inboxArea.style.display = 'none';
                UI_CONSTANTS.locationsArea.style.display = 'none';
                UI_CONSTANTS.storageArea.style.display = 'none';
                UI_CONSTANTS.settingsArea.style.display = 'block';

            }
        });
    }

    var notificare = new Notificare();

    notificare.onReady = (application) => {

        notificare.registerForNotifications();

        notificare.startLocationUpdates();

        handleAppIcon(application);

        handleSettingsToggles();

        handleInbox();

        handleDND();

        handleTags();

    }

    notificare.didRegisterDevice = (device) => {
        UI_CONSTANTS.pushToggle.checked = notificare.isWebPushEnabled();
    }

    notificare.didFailToRegisterDevice = (e) => {
        console.log('didFailToRegisterDevice', e);
    }

    notificare.didUpdateBadge = (badge) => {
        if (document.getElementById("appBadge")) {
            document.getElementById("appBadge").innerHTML = badge;
        }
        handleInbox();
    }

    notificare.didUpdateLocation = (location) => {
        console.log('didUpdateLocation', location);
    }

    notificare.didFailToUpdateLocation = (e) => {
        console.log('didFailToUpdateLocation', e);
    }

    notificare.didReceiveNotification = (notification) => {
        console.log(notification);
    }


    notificare.didReceiveUnknownNotification = (notification) => {
        console.log(notification);
    }


    notificare.didReceiveWorkerPush = (notification) => {
        console.log(notification);
    }


    notificare.didReceiveSystemNotification = (notification) => {
        console.log(notification);
    }

    notificare.didOpenNotification = (notification) => {
        handleNotification(notification);
    }

    notificare.shouldPerformActionWithURL = (url) => {
        window.location.href = url;
    }


    function handleAppIcon(application){
        UI_CONSTANTS.applicationInfo.innerHTML = "<div id='appBadge' class='badge'>" + notificare.inboxManager.myBadge() + "</div><img class='app-icon' src='https://push.notifica.re/upload" + application.websitePushConfig.icon + "'><h1> " + application.name + "</h1><p>" + application.category + "</p>";
        UI_CONSTANTS.demo.style.display = 'block';
    }

    function handleSettingsToggles(){

        var switchPush,switchLocation;

        UI_CONSTANTS.pushToggle.checked = notificare.isWebPushEnabled();
        UI_CONSTANTS.locationToggle.checked = notificare.isLocationServicesEnabled();

        switchPush = new Switchery(UI_CONSTANTS.pushToggle),
            switchLocation = new Switchery(UI_CONSTANTS.locationToggle);

        UI_CONSTANTS.pushToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                notificare.registerForNotifications();
            } else {
                notificare.unregisterForNotifications();
            }
        });

        UI_CONSTANTS.locationToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                notificare.startLocationUpdates();
            } else {
                notificare.stopLocationUpdates();
            }
        });
    }


    function handleInbox(){

        notificare.inboxManager.fetchInbox().then((response) => {

            if (response.inboxItems && response.inboxItems.length > 0) {

                while (UI_CONSTANTS.inboxItems.firstChild) {
                    UI_CONSTANTS.inboxItems.removeChild(UI_CONSTANTS.inboxItems.firstChild);
                }

                response.inboxItems.forEach(function(inboxItem){
                    var li = document.createElement("li"), a = document.createElement("a"), title = document.createElement("h2"), subtitle = document.createElement("h3"), message = document.createElement("p"), date = document.createElement("span"), attachment = document.createElement("img");
                    message.appendChild(document.createTextNode(inboxItem.message));
                    date.appendChild(document.createTextNode(moment(inboxItem.time).format('LLLL')));
                    date.setAttribute("class", "date");

                    if (inboxItem.attachment && inboxItem.attachment.uri) {
                        attachment.setAttribute("class", "attachment");
                        attachment.setAttribute("src", inboxItem.attachment.uri);
                        a.appendChild(attachment);
                    }

                    a.appendChild(date);

                    if (inboxItem.title) {
                        title.appendChild(document.createTextNode(inboxItem.title));
                        a.appendChild(title);
                    }

                    if (inboxItem.subtitle) {
                        subtitle.appendChild(document.createTextNode(inboxItem.subtitle));
                        a.appendChild(subtitle);
                    }

                    a.appendChild(message);

                    a.setAttribute("href", '#');
                    a.setAttribute("rel", inboxItem.notification);
                    if (inboxItem.opened) {
                        a.setAttribute("class", "read");
                    }

                    a.onclick = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        notificare.inboxManager.openInboxItem({notification: this.getAttribute('rel')}).then((response) => {
                           handleNotification(response);
                        });
                    };

                    li.appendChild(a);
                    UI_CONSTANTS.inboxItems.appendChild(li);
                });
            }

        }).catch((e) => {
            console.log(e);
        });
    }


    function handleDND(){

        notificare.fetchDoNotDisturb().then((dnd) => {

            console.log(dnd);
            if (dnd) {
                UI_CONSTANTS.dndToggle.checked = true;
                UI_CONSTANTS.dndTimes.style.display = 'block';
            }

            var switchDND = new Switchery(UI_CONSTANTS.dndToggle);

            UI_CONSTANTS.dndToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    notificare.updateDoNotDisturb(UI_CONSTANTS.dndStart.value, UI_CONSTANTS.dndEnd.value);
                    UI_CONSTANTS.dndTimes.style.display = 'block';
                } else {
                    notificare.clearDoNotDisturb();
                    UI_CONSTANTS.dndTimes.style.display = 'none';
                }
            });

            UI_CONSTANTS.dndStart.addEventListener('change', () => {
                notificare.updateDoNotDisturb(UI_CONSTANTS.dndStart.value, UI_CONSTANTS.dndEnd.value);
            });

            UI_CONSTANTS.dndEnd.addEventListener('change', () => {
                notificare.updateDoNotDisturb(UI_CONSTANTS.dndStart.value, UI_CONSTANTS.dndEnd.value);
            });

        });
    }

    function handleTags(){

        notificare.fetchTags().then((tags) => {
            tags.forEach((tag) => {
                if (tag === 'tag_press') {
                    UI_CONSTANTS.tagPressToggle.checked = true;
                }

                if (tag === 'tag_events') {
                    UI_CONSTANTS.tagEventsToggle.checked = true;
                }

                if (tag === 'tag_newsletter') {
                    UI_CONSTANTS.tagNewsletterToggle.checked = true;
                }
            });

            var switchTagPress = new Switchery(UI_CONSTANTS.tagPressToggle),
                switchTagEvents = new Switchery(UI_CONSTANTS.tagEventsToggle),
                switchTagNewsletter = new Switchery(UI_CONSTANTS.tagNewsletterToggle);

        });

        UI_CONSTANTS.tagPressToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                notificare.addTag('tag_press');
            } else {
                notificare.removeTag('tag_press');
            }
        });

        UI_CONSTANTS.tagEventsToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                notificare.addTag('tag_events');
            } else {
                notificare.removeTag('tag_events');
            }
        });

        UI_CONSTANTS.tagNewsletterToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                notificare.addTag('tag_newsletter');
            } else {
                notificare.removeTag('tag_newsletter');
            }
        });
    }


    function handleNotification(notification){

        if (notification.type === 're.notifica.notification.Alert') {

            UI_CONSTANTS.notificationModal.style.display = 'block';
            UI_CONSTANTS.notificationModalContentPlaceholder.innerHTML = notification.message;

        } else if (notification.type === 're.notifica.notification.WebView') {

            UI_CONSTANTS.notificationModal.style.display = 'block';
            UI_CONSTANTS.notificationModalContentPlaceholder.innerHTML = notification.content[0].data;

        } else if (notification.type === 're.notifica.notification.URL' || notification.type === 're.notifica.notification.URLScheme') {

            window.location.href = notification.content[0].data;

        } else if (notification.type === 're.notifica.notification.Passbook') {

            UI_CONSTANTS.notificationModal.style.display = 'block';
            UI_CONSTANTS.notificationModalContentPlaceholder.innerHTML = '<iframe class="iframe-content" src="' + notification.content[0].data + '">';

        } else if (notification.type === 're.notifica.notification.Map') {

            UI_CONSTANTS.notificationModal.style.display = 'block';
            UI_CONSTANTS.notificationModalContentPlaceholder.innerHTML = '<div id="mapNotification"></div>';

            var map = new google.maps.Map(document.getElementById('mapNotification'), {
                zoom: 4,
                center: new google.maps.LatLng(notification.content[0].data.latitude, notification.content[0].data.longitude)
            });

            var markers = [];
            notification.content.forEach(function(content){
                var marker = new google.maps.Marker({
                    position: new google.maps.LatLng(content.data.latitude, content.data.longitude),
                    map: map
                });
                markers.push(marker);
            });

            var bounds = new google.maps.LatLngBounds();
            markers.forEach(function(marker){
                bounds.extend(marker.getPosition());
            });

            map.fitBounds(bounds);

        } else if (notification.type === 're.notifica.notification.Video') {

            UI_CONSTANTS.notificationModal.style.display = 'block';

            if (notification.content[0].type === 're.notifica.content.YouTube') {

                var youtube = "<!DOCTYPE html><html><head><style>body{margin:0px 0px 0px 0px;}</style></head> <body> <div id='player'></div> <script> var tag = document.createElement('script'); tag.src='https://www.youtube.com/player_api'; var firstScriptTag = document.getElementsByTagName('script')[0]; firstScriptTag.parentNode.insertBefore(tag, firstScriptTag); var player; function onYouTubePlayerAPIReady() { player = new YT.Player('player', { width:'100%', height:'395', videoId:'"+ notification.content[0].data +"', events: { 'onReady': onPlayerReady } }); } function onPlayerReady(event) { event.target.playVideo(); } </script></body></html>";
                UI_CONSTANTS.notificationModalContentPlaceholder.innerHTML = '<iframe class="iframe-content" srcdoc="' + youtube + '">';

            } else if (notification.content[0].type === 're.notifica.content.Vimeo') {
                var vimeo = "<!DOCTYPE html><html><head><style>body{margin:0px 0px 0px 0px;}</style></head><body><iframe src='https://player.vimeo.com/video/" + notification.content[0].data + "?autoplay=1' width='100%' height='395' frameborder='0' webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe></body> </html>";
                UI_CONSTANTS.notificationModalContentPlaceholder.innerHTML = '<iframe class="iframe-content" srcdoc="' + vimeo + '">';

            } else if (notification.content[0].type === 're.notifica.content.HTML5Video') {
                var mp4 = "<!DOCTYPE html><html><head><style>body{margin:0px 0px 0px 0px;}</style></head><body><video id='html5player' width='100%' height='395' autoplay controls preload><source src='" + notification.content[0].data + "' type='video/mp4'></video></body></html>";
                UI_CONSTANTS.notificationModalContentPlaceholder.innerHTML = '<iframe class="iframe-content" srcdoc="' + mp4 + '">';
            }

        } else if (notification.type === 're.notifica.notification.Image') {

            UI_CONSTANTS.notificationModal.style.display = 'block';

            var images = notification.content.reverse();

            images.forEach(function(image){
                var img = document.createElement("img");
                img.setAttribute('class', 'notification-image');
                img.setAttribute('src', image.data);
                UI_CONSTANTS.notificationModalContentPlaceholder.appendChild(img);
            });

        }


        UI_CONSTANTS.notificationModalActionsPlaceholder.innerHTML = '';

        if (notification.actions && notification.actions.length > 0) {

            notification.actions.forEach(function(action){
                var button = document.createElement("button");
                button.setAttribute('class', 'btn action-button');
                button.dataset.label = action.label;
                button.appendChild(document.createTextNode(action.label));
                UI_CONSTANTS.notificationModalActionsPlaceholder.appendChild(button);
            });

            document.querySelector('.action-button').addEventListener('click', function(e) {
                e.preventDefault();

                notificare.handleAction(notification, this.dataset.label);

                if (document.querySelector('.iframe-content')) {
                    document.querySelector('.iframe-content').srcdoc = "blank";
                }

                UI_CONSTANTS.notificationModal.style.display = 'none';
            });
        }

        UI_CONSTANTS.notificationModalClose.addEventListener('click', function(e) {
            e.preventDefault();
            UI_CONSTANTS.notificationModal.style.display = 'none';
        });

    }

    function handleMap(){

        var map = new google.maps.Map(UI_CONSTANTS.map, {
            zoom: 10,
            center: new google.maps.LatLng(51.92802,4.4553871)
        });

        notificare.performCloudAPIRequest('GET', '/region').then((response) => {

            if (response.regions && response.regions.length > 0) {

                var points = [];

                response.regions.forEach(function(region){

                    if (region.advancedGeometry &&
                        region.advancedGeometry.coordinates &&
                        region.advancedGeometry.coordinates.length > 0 &&
                        region.advancedGeometry.coordinates[0].length > 0) {


                        var polygon = [];
                        region.advancedGeometry.coordinates[0].forEach(function(coords){
                            polygon.push({
                                lat: coords[1],
                                lng: coords[0]
                            });
                        }.bind(this));

                        var polygonShape = new window.google.maps.Polygon({
                            paths: polygon,
                            strokeColor: '#232c2a',
                            strokeOpacity: 0.8,
                            strokeWeight: 5,
                            fillColor: '#232c2a',
                            fillOpacity: 0.5,
                            zIndex: 1,
                            editable: false,
                            draggable: false
                        });

                        polygonShape.setMap(map);

                        var c = new google.maps.Circle({
                            map: map,
                            center: new google.maps.LatLng(region.geometry.coordinates[1], region.geometry.coordinates[0]),
                            radius: region.distance,
                            strokeColor: '#232c2a',
                            strokeOpacity: 0,
                            strokeWeight: 5,
                            fillColor: '#232c2a',
                            fillOpacity: 0,
                            zIndex: 1,
                            editable: false
                        });

                        points.push(c);

                    } else {

                        var c = new google.maps.Circle({
                            map: map,
                            center: new google.maps.LatLng(region.geometry.coordinates[1], region.geometry.coordinates[0]),
                            radius: region.distance,
                            strokeColor: '#232c2a',
                            strokeOpacity: 0.8,
                            strokeWeight: 5,
                            fillColor: '#232c2a',
                            fillOpacity: 0.5,
                            zIndex: 1,
                            editable: false
                        });

                        points.push(c);

                    }


                }.bind(this));



                if (points && points.length > 0) {
                    var bounds = new window.google.maps.LatLngBounds();
                    points.forEach(function(point){
                        bounds.union(point.getBounds());
                    });
                    map.fitBounds(bounds);
                }

            }
        });
    }

    function handleAssets(assets){
        if (assets && assets.length > 0) {

            while (UI_CONSTANTS.assetGroups.firstChild) {
                UI_CONSTANTS.assetGroups.removeChild(UI_CONSTANTS.assetGroups.firstChild);
            }

            assets.forEach(function(asset){
                var li = document.createElement("li"), img = document.createElement("img");
                img.setAttribute("src", asset.url);
                li.appendChild(img);
                UI_CONSTANTS.assetGroups.appendChild(li);
            });
        }
    }

});