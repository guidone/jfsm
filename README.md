jQuery Finite State Machine
===========================

**jfsm** stands for jQuery Finite State Machine and it's a little script to help handling UI controls passing from a state to another.

## An example
Have you ever found yourself in a situation writing code like this?

	$('a.button1')
		.click(function() {
			// go to step2
			$('a.letsGoBack').show();
			$('a.button1').hide();
			$('a.button2').show();
			}); 	
	$('a.button2')
		.click(function() {
			// go to step3
			$('a.letsGoBack').show();
			$('a.button1').hide();
			$('a.button2').hide();
			$('a.save').show();
			$('.controlToDisableInStep3').addClass('disabled');
			});

In this script some controls must be visible and enabled in a state (for example step #1 of a wizard) and/or invisible in the next state.
Nothing wrong with the code above, but as soon as the complexity of the UI grows up, the code become un-mantainable.

Wouldn't be easier to define a set of possible states for our UI (for example step1, step2 and step3 for our multistep form) and define for each of them the behaviour of the UI components

	$('a.button1')
		.jfsm('step1',{visible: true})
		.jfsm('step2',{visible: false})
		.jfsm('step3',{visible: false});
	$('a.button2')
		.jfsm('step1',{visible: false})
		.jfsm('step2',{visible: true})
		.jfsm('step3',{visible: false}); 		
	$('a.save')
		.jfsm('step1',{visible: false})
		.jfsm('step2',{visible: false})
		.jfsm('step3',{visible: true});
	$('a.letsGoBack')
		.jfsm('step1',{visible: false})
		.jfsm('step2',{visible: true})
		.jfsm('step3',{visible: true});
	$('.controlToDisableInStep3')
		.jfsm('step3',{className: 'disabled'});

Then with a simple command we change the state $.jfsm('step3') and it will do the magic for you: .button2 and .button1 are hidden, .save and .letsGoBack ara visible and the control .controlToDisableInStep3 gains the class 'disabled'.
At first sight seems I've written more code, perhaps it's true, but I've grouped this kind of logic in just one place and it's easier to add element to the UI.

## Syntax
- $('element-selector').jfsm('mystate',<state-descriptor>);
Define a descriptor for an element on the state 'mystate'. The descriptor is an hash array which may contains one or more of these keys:
	* visible (true| false): make this element visibile or hidden in the defined state. The default is true (means that in any other state, if not specified, the element is visible)
	* className: assign a CCS class to the element in the defined state
	* click: assign a click handler for the element in the defined state (how did I do before this? Checking the state of the UI inside the click handler? Naaaa)
It's possible to register your own key in the descriptor, see below.
- $.jfsm('to-state');
Change the state the to 'to-state', triggering all the UI changes defined with the function above.
It always return a Deferred() object since the changes to the UI might be asynchronous.
	$.jfsm('to-state')
		.done(function() {
			// ta da
			});
In addition, when a transition is completed, an event 'jfsm-state' is triggered on $	('body'), the first argument is the new state name.
- $.jfsm(new_descriptor,descriptor_handler,predefined_value);
Define a new key for the state descriptor object
	* new_descriptor(string): a string representing the key in the state descriptor
	* descriptor_handler(function): the handler that operates the changes on the UI. The context (this) is the UI element to be changed, accepts two parameters f(from,to) which are the values of the key in the previous and new state, respectively (if these two values are the same in the transition, the handler will not be called).
	See the example below about defining a new descriptor
	* predefined_value(anything|function): defines which is the default value of the field in the state descriptor

# Adding a fadeout descriptor

Suppose I want to hide/show elements during transition using a fancy fade in/out effect.
First of all, register the *fade* key for the state descriptor:

	$.jfsm(
		'fade',
		function(from,to) {
			to = !!to; // to be sure is true or false
			if (to) 
				$(this).fadeIn();
			else $(this).fadeOut(); 
			},
		true
		); 

Then define the behaviour of the button

$('a.button1')
	.jfsm('step1',{fade: true})
	.jfsm('step2',{fade: false});

And now $.jfsm('step1') and $.jfsm('step2') will switch the state between step1 and step2, happily fading in and out your button.
But we can do even better, jfsm handles correctly deferred objects, we can improve the handler in this way:

	$.jfsm(
		'fade',
		function(from,to) {
			to = !!to; // to be sure is true or false
			var deferred = $.Deferred();
			if (to) 
				$(this).fadeIn(function() { deferred.resolve(); });
			else $(this).fadeOut( function() { deferred.resolve(); }); 
			return deferred.promise();
			},
		true
		); 	

The event 'jfsm-state' will be triggerd only when the fade transition is completed, or I can just use the deferred object returned by $.jfsm:

	$.jfsm('step1')
		.done(function() {
			// done fading
			});

