"use strict";


	
function WebSocketConnection()
{
var self = this;

//Includes

var WebSocket = null;

if (typeof exports !== "undefined")
	{
	//global.WebSocket = require("websocket").client;
	WebSocket = require("websocket");
	//global.logger = require("winston");
	}

if (typeof window !== "undefined")
	{
	WebSocket = window.WebSocket;
	}
else
	{
	WebSocket = WebSocket.w3cwebsocket;
	}	
	
var socket = null;
var id = null;
var remoteAddress = null;
var remotePort = null;
var origin = null;
var listener = null;
var pipedTo = null;

//For client-side use, in both node and the browser

self.connect = function(options, callback)
	{
	options.protocol = (!options.isSsl ? "ws" : "wss");	
	
	try	{	
		var url = options.protocol + "://" + options.host + ":" + options.port + "/"+"json-rpc";
		if (options.id)
			url += "?id="+options.id;
		socket = new WebSocket(url, "json-rpc");
		
		socket.binaryType = "arraybuffer";	
		socket.onopen = function() {callback(null); }; 
		socket.onmessage = onMessageEvent;
		socket.onclose = function(reasonCode, description) {onSocketClosed(reasonCode, description, self);};	
		}
	catch (e)
		{
		console.log(e);
		}
	};

//For server-side node.js use only

self.setSocket = function(val) 
	{
	console.log("WebSocketConnection::setSocket()");	
	try	{
		socket = val;		
		socket.on("message", onMessage);
		socket.on("close", function(reasonCode, description) {onSocketClosed(reasonCode, description, self);});
		}
	catch (e)
		{
		console.log(e);
		}	
	};
	
self.setId = function(val) 
	{
	id = val;	
	};
	
self.setPipedTo = function(targetId)
	{
	pipedTo = targetId;
	};
	
self.getPipedTo = function()
	{
	return pipedTo;
	}	
	
self.setRemoteAddress = function(val) 
	{
	remoteAddress	= val;
	};
	
self.setRemotePort = function(val) 
	{
	remotePort = val;	
	};
	
self.setOrigin = function(val) 
	{
	origin = val;	
	};
	
self.setListener = function(val) 
	{
	listener = val;	
	};

self.getId = function() 
	{
	return id;	
	};
	
self.getRemoteAddress = function() 
	{
	return remoteAddress;
	};
	
self.getRemotePort = function() 
	{
	return remotePort;	
	};
	
self.getOrigin = function() 
	{
	return origin;	
	};
	
var onMessage = function(message)
	{
	console.log("WebSocketConnection::onMessage() "+JSON.stringify(message));	
	try	{
		if (listener)
			{
			if (message.type == "utf8")
				listener.onMessage(message.utf8Data, self);
			if (message.type == "binary")
				listener.onMessage(message.binaryData, self);
			}
		}
	catch (e)
		{
		console.log(e);
		}	
	};

var onMessageEvent = function(event)
	{
	console.log("WebSocketConnection::onMessageEvent() " + JSON.stringify(event.data)); 
	try	{
		if (listener)
			listener.onMessage(event.data, self);
		}
	catch(e)
		{
		console.log(e);
		}	
	};
	
var onSocketClosed = function(reasonCode, description, obj)
	{
	try	{
		if (listener)
			listener.onDisconnected(obj.getId());
		}
	catch(e)
		{
		console.log(e);
		}	
	};
	
self.send = function(message)
	{
	try	{
		socket.send(message);	
		}
	catch(e)
		{
		console.log(e);
		}	
	};

self.sendBinary = self.send;

self.close = function()
	{
	try	{
		socket.close();
		}
	catch(e)
		{
		console.log(e);
		}	
	};
}

if (typeof exports !== "undefined")
	{
	module.exports = WebSocketConnection;	
	}
