/*
	jQuery Finite State Machine - version 1.0
	http://github.com/guidone/jfsm
	Guido Bellomo
	guido.bellomo@gmail.com - http://javascript-jedi.com
	Free for personal and commercial use under the MIT/GPL license used by the jQuery core libraries.
*/
$(function() {

	var _uid_generator = 1;
	var _states = {};
	var _elements = {};
	var _current = null;		
	var _methods = {};
	var _attributes = []; 	
	
		
	function _registerHandler(name,method,predefined) {
		_methods[name] = {
			method: method,
			predefined: predefined
			};
		_attributes.push(name);
		}
	
	_registerHandler(
		'visible',
		function(from,to) {
				
			to = !!to;
			// if visible on entering show, otherwise hide
			var that = $(this);
			if (to) {
				that.show();
				}
			else {
				that.hide();
				} 
			return that;
			},
		true
		);	

	_registerHandler(
		'className',
		function(from,to) {
			var that = $(this);
			if (from != null && from !== '') {
				that.removeClass(from);	
				}
			if (to != null && to !== '') {
				that.addClass(to);	
				}								
			return that;
			},
		null
		);

	_registerHandler(
		'click',
		function(from,to) {
			var that = $(this);
			if (from != null && from !== '') {
				that.unbind('click.jfsm');	
				}
			if (to != null && to !== '') {
				that.bind('click.jfsm',to);	
				}								
			return that;
			},
		null
		);
	
	
	
	function _elementNotPresent(a,e) {

		var idx = 0;
		for (idx = 0; idx < a.length; idx++) {
			if (a[idx] == e) {
				return true;
				}
			}
		
		return false;
		}
	
	
	// **
	// !_transitionMatrix
	// Get the transition matrix for the new state
	//
	function _transitionMatrix(state) {
		

		var result = [];
		var _uis = [];
		var k = null;
		
		// collect all ids from both states
		if (_states[state] != null) {
			for (k in _states[state]) {
				_uis.push(k);
				}
			}
		if (_current != null && _states[_current] != null) {
			for (k in _states[_current]) {
				if (!_elementNotPresent(_uis,k)) {
					_uis.push(k);
					}
				}			
			} 	
		// now I have a list of elements which at least a transaction entering or exiting the state
		
		$(_uis).each(function() {
			var _uid = String(this);
			var element = _elements[_uid];
			if (element != null) {
				
				// now scan the value for each
				$(_attributes).each(function() {
					var attributeName = String(this);
					var fromAttributeValue = null;
					var toAttributeValue = null;
					// check for starting state, if not attributes present the call the predefined method to get one
					if (_current != null && _states[_current] != null 
						&& _states[_current][_uid] != null && _states[_current][_uid][attributeName] != null) {
						fromAttributeValue = _states[_current][_uid][attributeName];	
						}
					else {
						if ($.isFunction(_methods[attributeName].predefined)) {
							fromAttributeValue = _methods[attributeName].predefined.call(element);
							}
						else {
							fromAttributeValue = _methods[attributeName].predefined;
							}
						}
					// check for ending state, if not attributes present the call the predefined method to get one
					if (_states[state] != null 
						&& _states[state][_uid] != null && _states[state][_uid][attributeName] != null) {
						toAttributeValue = _states[state][_uid][attributeName];	
						}
					else {
						if ($.isFunction(_methods[attributeName].predefined)) {
							toAttributeValue = _methods[attributeName].predefined.call(element);
							}
						else {
							toAttributeValue = _methods[attributeName].predefined;
							}
						}
					// now if the attrribute value area different, then add to the queue
					if (fromAttributeValue != toAttributeValue) {
						result.push({
							uid: _uid,
							method: attributeName,
							from: fromAttributeValue,
							to: toAttributeValue
							});							
						}
					
					});
				
				} // end if not null						
			});
			
		
		return result;
		
		}
	
	
	
	function _parallel(stack) {
		
		var deferred = $.Deferred();
		var idx = 0;
		var counter = stack.length;
		var sub_and_check = function() {
			counter--;
			if (counter == 0) deferred.resolve();
			};
		
		for (idx = 0; idx < stack.length; idx++) {
			var tmp = stack[idx].call();
			// is this a deferred
			if ($.isFunction(tmp.done)) {
				tmp.always(sub_and_check);
				}
			else {
				sub_and_check();
				}			
			}				
						
		return deferred.promise();		
		}
	
	
	function _executeTransition(state) {
		
		
		var _matrix = _transitionMatrix(state);
		var deferred = $.Deferred();				
		//var stack = $function();
		var stack = [];
	
		$(_matrix).each(function(idx) {
			var action = this;				
			stack.push(function() {				 
				var result = _methods[action.method].method.call(
					_elements[action.uid],
					action.from,
					action.to
					);								
				return result;
				});
			});
		
		//$.when(stack.promise())
		_parallel(stack)
			.done(function() {
				
				// cast event
				$('body').trigger('jfsm_state',state);
				// set the new state
				_current = state;
				// then resolve
				deferred.resolve();
				})
			.fail(function() {	
				deferred.reject();
				});
		

		return deferred.promise();
		}
	
	
	$.extend({
		
		jfsm: function(arg1,arg2,arg3) {
			
			// if no params, return the current state
			if (arg1 === undefined) {
				return _current;
				}
			
			// if second parameter is a function, then I'm registering an handle
			if ($.isFunction(arg2)) {
				_registerHandler(arg1,arg2,arg3)				
				}
			else if (arg1 != null) {
				
				if (arg1 != _current) {				
					return _executeTransition(arg1);				
					}
				else {
					var deferred = $.Deferred();
					deferred.resolve();	
					return deferred.promise();
					}
				}
			}
		
		});
	
		

	$.fn.extend({
		
		
		jfsm: function(state,attributes) {
			
			var that = $(this);
			
			// set the uid if none
			if (that.data('jfsm_uid') == null) {
				that.data('jfsm_uid',_uid_generator++);
				}
			var uid = that.data('jfsm_uid'); 	
			
			// if not present store the element
			if (_elements[uid] == null) {
				_elements[uid] = that;
				}
			// if state doesnt exists
			if (_states[state] == null) {
				_states[state] = {};				
				}
			// finally store the attributes
			_states[state][uid] = attributes;
// !todo if already exists 

			
			return that;
			} // end jfstm
		
		});
	
	
	});