MyApp.Notification = DS.Model.extend({	
	name: DS.attr('string'),
	billingInfo: DS.attr('raw'),
	email: DS.attr('string'),
	password: DS.attr('string'),
	token: DS.attr('string'),
	active: DS.attr('boolean'),
	accessWarning: DS.attr('boolean'),
	plan: DS.attr('string'),
	userLimit: DS.attr('number'),
	superAccount: DS.attr('boolean'),
	subscription: DS.attr('boolean'),
	subscriptionId: DS.attr('string'),
	automaticUpgrade: DS.attr('boolean'),
	registrationDate: DS.attr('date'),
	firstTime: DS.attr('boolean')
});
