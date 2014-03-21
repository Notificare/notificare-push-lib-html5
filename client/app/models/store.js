MyApp.RESTAdapter = DS.RESTAdapter.extend({
 	namespace: 'api'
});


MyApp.Store = DS.Store.extend({
	revision: 13,
	adapter: 'MktPlace.RESTAdapter'
});

MyApp.Store.registerAdapter('MyApp.Notification', MyApp.RESTAdapter.extend({}));
MyApp.Store.registerAdapter('MyApp.Device', MyApp.RESTAdapter.extend({}));


MyApp.RESTAdapter.registerTransform('raw', {
	deserialize: function(serialized) {
		return serialized;
	},  
	serialize: function(deserialized) {
		return deserialized;
	}   
});
