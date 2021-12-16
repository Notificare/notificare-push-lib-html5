/*!
 * Notificare -  v2.7.1 (https://notificare.com)
 * Copyright 2012 - 2021 Notificare
 */
self.addEventListener("push",function(i){try{var n=i.data.json();if(n["x-sender"]&&"notificare"===n["x-sender"])if(n.alert){if(n.actions){var e=[];n.actions.forEach(function(t){e.push({title:t.label,action:t.label,icon:t.icon?t.icon:null})})}self.clients.matchAll().then(function(t){t.forEach(function(t){t.postMessage(JSON.stringify({cmd:"notificationreceive",message:n.id}))})});var t=n.icon;"image"in Notification.prototype||(t=n.attachment&&n.attachment.uri?n.attachment.uri:n.icon),i.waitUntil(self.registration.showNotification(n.alertTitle||n.application,{body:n.alert,icon:t,tag:n.id,actions:e,data:n,requireInteraction:n.requireInteraction,renotify:n.renotify,image:n.attachment&&n.attachment.uri?n.attachment.uri:null,sound:n.sound?n.sound:null}))}else n.system?i.waitUntil(self.clients.matchAll().then(function(t){t.forEach(function(t){t.postMessage(JSON.stringify({cmd:"system",message:n}))})})):i.waitUntil(self.clients.matchAll().then(function(t){t.forEach(function(t){t.postMessage(JSON.stringify({cmd:"notificationreceive",message:n.id}))})}));else i.waitUntil(self.clients.matchAll().then(function(t){t.forEach(function(t){t.postMessage(JSON.stringify({cmd:"unknownpush",message:n}))})}))}catch(t){i.waitUntil(self.clients.matchAll().then(function(t){t.forEach(function(t){t.postMessage(JSON.stringify({cmd:"workerpush",message:n}))})}))}}),self.addEventListener("notificationclick",function(e){e.notification.close(),e.waitUntil(clients.matchAll({type:"window"}).then(function(t){if(0==t.length){var i=e.notification.data.urlFormatString.replace("%@",e.notification.tag);return e.action&&setTimeout(function(){clients.matchAll().then(function(t){t.forEach(function(t){t.postMessage(JSON.stringify({cmd:"notificationreply",message:e.notification.tag,action:e.action,bg:!0}))})})},2e3),clients.openWindow(i)}var n=t[0];i=e.notification.data.urlFormatString.replace("%@",e.notification.tag);if(n&&"focus"in n)return e.action?self.clients.matchAll().then(function(t){t.forEach(function(t){t.postMessage(JSON.stringify({cmd:"notificationreply",message:e.notification.tag,action:e.action,bg:!1}))})}):n.postMessage(JSON.stringify({cmd:"notificationclick",message:e.notification.tag,url:i})),n.focus()}))}),self.addEventListener("activate",function(t){clients.claim(),clients.matchAll().then(function(t){t.forEach(function(t){t.postMessage(JSON.stringify({cmd:"activate"}))})})}),self.addEventListener("pushsubscriptionchange",function(t){clients.claim(),clients.matchAll().then(function(t){t.forEach(function(t){t.postMessage(JSON.stringify({cmd:"pushsubscriptionchange"}))})})}),self.addEventListener("install",function(t){t.waitUntil(self.skipWaiting())}),self.addEventListener("message",function(t){if(t&&t.data)try{switch(JSON.parse(t.data).action){case"init":break;default:console.log(t)}}catch(t){console.log(t)}});