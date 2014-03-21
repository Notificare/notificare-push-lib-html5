MyApp.Device = DS.Model.extend({
	deviceID: DS.attr('string'),
	userID: DS.attr('string'),
	userName: DS.attr('string'),
	platform: DS.attr('string'),
	osVersion: DS.attr('string'),
	sdkVersion: DS.attr('string'),
	appVersion: DS.attr('string'),
	deviceString: DS.attr('string'),
	transport: DS.attr('string'),
	timeZoneOffset: DS.attr('string')
});
