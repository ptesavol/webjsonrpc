"use strict";


function CallbackBuffer(initialListSize)
{
var self = this;

var callbacks = new Object();

self.pushBack = function(id, object, method)
	{
	callbacks[id] = [object, method];
	};

self.callMethodAndPop = function(id, error, result)
	{
	if (callbacks.hasOwnProperty(id))
		{
		(callbacks[id][1]).call(callbacks[id][0], error, result, id);	
		delete callbacks[id]; 
		}
	else
		throw {error: "CallbackBuffer::callMethodAndPop(). Callback not found"};	
	};
}

if (typeof exports !== "undefined")
	{
	module.exports = CallbackBuffer;
	}
