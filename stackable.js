/*global console: true */
/*
	Stackable v1.2.3
	2011, Guido Bellomo
	Stack of functions with smart execution
	
	
	// create a stack of executable functions
	
	Common usage:
	
	stack = $funtion(<func1>,<func2>,..,context); 
	Create a stack with n functions and a context
	
	stack = $function(<func1>);
	Create a stack with just one function

	stack = $function(stack); // return itself
	Return itself, like $
	
	$function(options.callback).push(<func>);
	Append a function to a stack or an existing callback function. Nothing will change
	if the caller uses apply/call for the callback


	stack.unshift(function)
	stack.push(function) - append/prepend a function to the stack, function can be indifferently synchronous
		function or asynchronous function (with Deferred/Promise pattern) 
	
	
	stack.cascade(param1,param2,..,paramN) - call sequentially the functions of the stack
		this is the context specified on creation, result of function is the result of 
		the last function of the stack 
	stack.filter(param) - call functions of the stack as a filter, the result of the 
		first function is the argument of the second and so on, the result of the function
		is the result of the last function of the stack.
		Since functions can return just one value, each function of the stack accept just one
		argument
	stack.mode('filter' | 'cascade') - set the mode of the stack, filter or cascade	
	stack.fork(context) - fork the stack of functions, call with 1ms of delay
	stack.apply(context,array_of_params) - works exactly as .apply for functions, uses mode 'cascade'
		or the mode set with mode()
	stack.call(context,param1,param2,..,paramN) - works exactly as .call for function
		in 'cascade' mode if no mode is set with mode()
	stack.context(context) - set the context of the stack
	stack.length() - the length of the stack
	stack.get(key) - return the value of the hash for this stack
	stack.callback(fn) - execute the function fn at the end of the stack
	stack.promise(args) - start the stack and return the jQuery promise object, to be used with
		done() and fail()
	
	An example of function of the stack
	
	function(param1,param2,..,paramN,execution) {
		
		$(this); // I'm the context
		
		return something;
		
		}
	
	Each function of the stack receives the same number of arguments used in .cascade(), .filter(),
	.synch(), .apply() and .call() plus one: a stack object which allows the following operation
	
	
	execution.index() - return the index of the function in the stack
	execution.end() - stops the execution of the stack at the end of the current function 
	execution.get(key) - get a value for a key in the hash of the stack (for example set from a previous
		function of the stack). Cleared at each execution
	execution.set(key,value) - set a key/value pair in the hash of the stack	 
	

todo
- apply doesn't work
- composite result for cascade


*/


var Stackable = function(context,synch) {
	
	var idx = 0;
	var _context = context;
	var _stackedFunctions = [];
	var _callback = null;
	var _failback = null;
	var _mode = 'cascade';
	var _allowedMode = ['cascade','filter'];
	var _vars = {};
	//var _synch = synch != null ? !!synch : true;
	//var _isPromise = false;
	var _asynchIdx = 0;
	var _stack = {
		
		index: function() {
			return idx;
			},
		end: function() {
			idx = _stackedFunctions.length;
			},
		get: function(key) {
			return _vars[key];
			},
		set: function(key,value) {
			_vars[key] = value;
			}
		};
	
	function _copyArguments(args) {		
		var idx = 0;
		var result = [];
		for (idx = 0; idx < args.length; ++idx)
			result.push(args[idx]);
		return result;		
		}

	function isFunction(o) {
		return typeof(o) == 'function' && (!Function.prototype.call ||
		typeof(o.call) == 'function');
		}

	function isPromise(obj) {
		return obj != null && obj.promise != null && isFunction(obj.promise);		
		}

	function _igniteSynchro(idx,args,result) {	

		var tmp_result = null;

		// if end of stack, then return and/or callback
		if (idx >= _stackedFunctions.length) {
			// end, callback if any
			if ($.isFunction(_callback))
				_callback.call(_context,result);			
			// exits
			return result;
			}

		tmp_result = _stackedFunctions[idx].apply(_context,args);

		if (isPromise(tmp_result)) {
			$.when(tmp_result)
				.done(function(result) {
					_igniteSynchro(idx+1,args,result);	
					})
				.fail(function(result) {
					// resets
					idx = 0;
					// failback a ends the cycle
					if ($.isFunction(_failback))
						_failback.call(_context,result);					
					return false;
					});
			// return null since the functions ends here
			return null;		
			}
		else {
			// skip to next			
			var what =  _igniteSynchro(idx+1,args,tmp_result);
			return what;
			}
			
		}


	function _igniteFunnel(idx,arg,result) {	

		//console.log('_igniteFunnel'+idx,arg,result);

		var tmp_result = null;

		// if end of stack, then return and/or callback
		if (idx >= _stackedFunctions.length) {
			// end, callback if any
			if ($.isFunction(_callback))
				_callback.call(_context,result);			
			// exits
			return result;
			}

		// execute the function in the stack
		tmp_result = _stackedFunctions[idx].call(_context,arg);

		if (isPromise(tmp_result)) {
//console.info('Promessa',tmp_result.state());		
			$.when(tmp_result)
				.done(function(result) {
					_igniteFunnel(idx+1,result,result);	
					})
				.fail(function(result) {
					return false;
					});
			// return null since the functions ends here
			return null;		
			}
		else {
			// skip to next			
			return _igniteFunnel(idx+1,tmp_result,tmp_result);
			}
			
		}
/*
	function _igniteFunnel2(idx,arg) {	

		if (idx >= _stackedFunctions.length) {
			// end, callback if any
			if ($.isFunction(_callback))
				_callback.call(_context,arg);			
			// exits
			return false;
			}

		$.when(_stackedFunctions[idx].call(_context,arg))
			.done(function(arg) {
				_igniteFunnel(idx+1,arg);	
				})
			.fail(function(arg) {
				return false;
				});
		}
*/

	function _recursivePush(items) {
		var k = 0;
		for(k = 0; k < items.length;++k)
			if (isFunction(items[k]))
				_stackedFunctions.push(items[k]);
			else if ($.isArray(items[k]))
				_recursivePush(items[k]);
		
		}

	// init
	if (arguments.length > 0 && typeof arguments[0] == 'object' && isFunction(arguments[0].stckbl_test)) {
		// it's me, return myself
		return arguments[0];
		}
	else {
		_recursivePush(arguments);
		var last = arguments.length-1;
		/*
		var k = 0;
		for(k = 0; k < arguments.length;++k)
			if (isFunction(arguments[k]))
				_stackedFunctions.push(arguments[k]);
			else _context = _context != null ? arguments[k] : _context;
		*/
			
		_context = !isFunction(arguments[last]) ? arguments[last] : _context;
		}	
	
	
	
	
	return {
		
		dump: function() {
			return {
				stack: _stackedFunctions,
				context: _context
				};
			},
		// **
		// !push
		// Push a function at the end of the stack
		//
		push: function(func) {
			_stackedFunctions.push(func);
			return this;		
			},
		
		// **
		// !mode
		// Sets the mode for this stack
		//
		mode: function(mode) {			
			if ($.inArray(mode,_allowedMode) != -1)
				_mode = mode;
			return this;
			},
		
		// **
		// !callback
		// Set the callback for asynch stacks
		//
		callback: function(callback) {
			if ($.isFunction(callback))
				_callback = callback;
			return this;
			},
		
		// **
		// !failback
		// Set a failback function (in case of deferred objects)
		//
		failback: function(failback) {
			if ($.isFunction(failback))
				_failback = failback;
			return this;			
			},
		
		unshift: function(func) {
			_stackedFunctions.unshift(func);
			return this;			
			},
		
		context: function(obj) {
			_context = obj;
			},
		
/*
		filter: function(inputVar) {
			var temp = inputVar;
			_vars = {}; // clear vars
			for(idx = 0; idx < _stackedFunctions.length;++idx) {
				var tmpArguments = [ temp ];
				tmpArguments.push(_stack);				
				temp = _stackedFunctions[idx].apply(_context,tmpArguments);
				}
			return temp;		
			},
*/
		
		length: function() {
			return _stackedFunctions.length;
			},
		
/*
		cascade: function() {						
			var temp = null;			
			var tmpArguments = _copyArguments(arguments);
			tmpArguments.push(_stack);
			_vars = {};
			
			for(idx = 0; idx < _stackedFunctions.length;++idx) {
				temp = _stackedFunctions[idx].apply(_context,tmpArguments);
				}

			return temp;					
			},
*/		
		stckbl_test: function() { // just a test to verify a stackable object
			return 'stackableObject';
			},

		// **
		// !cascade
		// Execute the stack of function in order as with the promise pattern (asynchronous functions)
		// at the end execute a callback
		//
		cascade: function(args) {
			_asynchIdx = 0;
			var tmpArguments = _copyArguments(arguments);
			return _igniteSynchro(_asynchIdx,tmpArguments);			
			},

		// **
		// !funnel
		// Execute the stack of function in order with the promise pattern (asynchronous function)
		// each result is the argument of the next function, the last function returns results
		// to the callback
		// Since function can return a single value, a single argument is allowed in funnel mode
		//
		filter: function(arg) {
			_asynchIdx = 0;
			return _igniteFunnel(_asynchIdx,arg);
			},

		get: function(key) {
			return _vars[key];
			},
		
		// **
		// !promise
		// Same interface as call but returns a deferred/promise object instead
		// which is resolved when the stack is completely executed
		//
		promise: function() {
		
			var deferred = $.Deferred();			
			var tmpArguments = [];
			if (arguments.length > 0) {
				tmpArguments = _copyArguments(arguments);
				_context = tmpArguments.shift();
				tmpArguments.push(_stack); 
				}

			// set the callback
			this.callback(function(result) {
				// resolve the deferred object
				deferred.resolve(result);
				});
			this.failback(function(result) {
				deferred.reject(result);
				})	

// e il fail?
		
			// ignite the stack
			if (_mode == null || _mode == 'cascade') {
				_asynchIdx = 0;
				_igniteSynchro(_asynchIdx,tmpArguments);				
				}
			else if (_mode == 'filter') {
				_asynchIdx = 0;
				_igniteFunnel(_asynchIdx,tmpArguments[0]);
				}						
			
			// return the promise
			return deferred.promise();
			},
		
		// **
		// !call
		// Simulate the call method
		//
		call: function() {
			
			var tmpArguments = [];
			if (arguments.length > 0) {
				tmpArguments = _copyArguments(arguments);
				_context = tmpArguments.shift();
				tmpArguments.push(_stack); 
				}

			if (_mode == null || _mode == 'cascade') {
				_asynchIdx = 0;
				return _igniteSynchro(_asynchIdx,tmpArguments);				
				}
			else if (_mode == 'filter') {
				_asynchIdx = 0;
				return _igniteFunnel(_asynchIdx,tmpArguments[0]);
				}
			else return this;
				
			},
		
		apply: function(context,params) {
			_context = context;
			return this.cascade.apply(this,params); // sure?
			},
		
		// **
		// !fork 
		// For the stack of functions launching them with a delay o 1ms
		// allowing refresh of UI for example
		// TODO implement promise/pattern
		//	
		fork: function(context) {
			
			$(_stackedFunctions).each(function() {
				setTimeout($.proxy(this,context),1);				
				});
			return this;				
			}	
		
		};
	};
var $function = Stackable;