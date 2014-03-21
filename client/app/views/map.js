Notificare.MapView = Ember.View.extend({
	classNames: ['map'],
	map: null,

	didInsertElement: function(){
		var element = this.$()[0].id;

		var mapOptions = {
				scrollwheel: false,
				zoomControl: true,
				zoomControlOptions: { style: this.get('options').get('style')},
				zoom : this.get('options').get('zoom'),
				center : this.get('options').get('center'),
				mapTypeId : this.get('options').get('mapTypeId'),
				mapTypeControl: true,
				mapTypeControlOptions: {
					style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
				},
				panControl: true,
				streetViewControl: false,
				overviewMapControl: true
			};

		this.map = new google.maps.Map(document.getElementById(element), mapOptions);
		
	}
});

Notificare.GeoQueryView = Ember.View.extend({
	classNames: ['geo-query'],
	location: null,

	didInsertElement: function(){
		var geocoder = new google.maps.Geocoder();
		var latLng = new google.maps.LatLng(this.get('coordinates')[1],this.get('coordinates')[0]);
		geocoder.geocode( { 'latLng': latLng}, this.onLocationResults.bind(this));
	},
	onLocationResults: function(status, result){
		
		if (status == google.maps.GeocoderStatus.OK) {
			if(result && result.length > 0 && result[1]){
				console.log('location: ', result[1].formatted_address);
				this.set('location', result[1].formatted_address);
			}
		}
		
	}
});