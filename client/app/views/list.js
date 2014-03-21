Notificare.ListView = Ember.View.extend({
	tagName: 'li',
	classNameBindings: ['active'],
	classNames: ['dark-nav'],
	didInsertElement: function () {
		this._super();
		var _this = this;
		this.get('parentView').on('click', function () {
			_this.notifyPropertyChange('active');
		});
	},
	active: function() {
		return this.get('childViews.firstObject.active');
	}.property(),
	
	click: function(e){
		var controller = this.get('parentView.controller');
		controller.set('showHiddenMenu', false);
	}
});