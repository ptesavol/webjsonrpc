"use strict";

// Do this only in node.js, not in the browser

if (typeof exports !== "undefined")
	{
	global.CallbackBuffer = require("./callbackbuffer");
	}
		

/* 
* A class that implements the JSON-RPC 2.0 protocol.
* Communicates with the outside world with WebSocketConnection or WebRTCConnection objects
* on the layer below. This is a two-way class that implements both client and server functionality.
*
* BinaryRpcCommunicator is a version of the RPCCommunicator class that supports
* transmitting RPC calls in a binary format over-the-wire. This functionality is 
* turned on if handleBinary contructor parameter is set to "true". 
* The over-the-wire binary format for request is the following:
*
* | Message Length | MessageType | ID Length |   ID     | Method length | Method   | Params length | Params
* | (Uint64)       | (Uint32) =0 | (Uint32)  | (string) | (Uint32)      | (string) | (Uint64)      | (byte[])
* |----------------|-------------|-----------|----------|---------------|----------|---------------|-------
* 0                8             12         16   
*
* The reply format is the following
*
* | Message Length | MessageType | ID Length |   ID     | Error length  | Error    | Result length | Result
* | (Uint64)       | (Uint32) =1 | (Uint32)  |(string)  | (Uint32)      | (string) | (Uint64)      | (byte[])
* |----------------|-------------|-----------|----------|---------------|----------|---------------|----
* 0                8            12          16
*
* In Javascript, the Params and Result fields are handled as ArrayBuffers, and their interpretation
* is left to the corresponding RPC methods. 
*
*/

function BinaryRpcCommunicator(handleBinary)
{
var self = this;

var callSequence = 1;
var exposedRpcMethods = new Object();

//var logger = new Logger();

var connectionListener = null;
var disconnectionListener = null;
var binaryListener = null;

var uri = "";
var callbackBuffer = new CallbackBuffer();
var connections = new Object();
var connectionSequence = 0;
var latestConnectionId = null;

//** Upwards interface towards business logic

self.exposeRpcMethod = function(name, object_, method_)
	{
	//console.log("RpcCommunicator::exposeRpcMethod name: "+name+", object_: "+object_+", method_: "+ method_);	
	try	{
		exposedRpcMethods[name] = {object: object_, method: method_};
		}
	catch(e)
		{
		console.log(e);
		}	
	};

self.setConnectionListener = function(object_, listener_)
	{
	connectionListener = {object: object_, listener: listener_}; 
	};
	
self.setDisconnectionListener = function(object_, listener_)
	{
	disconnectionListener = {object: object_, listener: listener_};
	};	

self.setBinaryListener = function(lis)
	{
	binaryListener = lis;
	};

self.connectionExists = function(connectionId)
	{
	if (typeof connectionId !== "undefined" && connections.hasOwnProperty(connectionId) )
		return true;
	else if (typeof connectionId === "undefined" && connections.hasOwnProperty(latestConnectionId))	
		return true;
	else 
		return false;
	};
	
self.getConnection = function(connectionId)
	{
	return connections[connectionId];
	};
		
//Outgoing RPC call

self.callRpc =  function(method, params, object, listener, connectionId)
	{
	if (!self.connectionExists(connectionId))
		return;
	try	{
		if (typeof listener == "function")	// call: expects a response object
			{
			callbackBuffer.pushBack(callSequence, object, listener);
		
			console.log("RpcCommunicator::callRpc() pushed back callback");
		
			if (typeof connectionId !== "undefined")						
				sendMessage({"jsonrpc": "2.0", "method": method, "params": params, "id": ""+callSequence}, connectionId);	
			else
				sendMessage({"jsonrpc": "2.0", "method": method, "params": params, "id": ""+callSequence}, latestConnectionId);	//assume there is only one connection	
		
			console.log("RpcCommunicator::callRpc() sendMessage returned");
			callSequence++;			
			}
		else	
			{											// notification: doesn't expect a response object
			if (typeof connectionId != "undefined")
				{
				if (typeof params == "ArrayBuffer")
					sendBinaryCall(null, method, params, connectionId);
				else
					sendMessage({"jsonrpc": "2.0", "method": method, "params": params}, connectionId);
				}
			else
				{
				if (typeof params == "ArrayBuffer")
					sendBinaryCall(null, method, params, latestConnectionId);
				else
					sendMessage({"jsonrpc": "2.0", "method": method, "params": params}, latestConnectionId);
				}
			}
		}
	catch(e)
		{
		console.log(e);	
		}		
	};

// Sends a RPC notification to all connections	
self.notifyAll =  function(method, params)
	{
	try	{
		for (var key in connections)
			{
			console.log("RpcCommunicator::notifyAll() sending message to "+key);
			sendMessage({"jsonrpc": "2.0", "method": method, "params": params, "id": null}, key);
			}
		console.log("RpcCommunicator::notifyAll() sending messages completed");
		}
	catch(e)
		{
		console.log(e);	
		}	
	};

self.getBufferedAmount = function(connectionId)
	{
	return connections[connectionId].getBufferedAmount();	
	};
	
self.sendBinary = function(data, connectionId)
	{
	//console.log("RPCCommunicator::sendBinary() "+data.byteLength);
	try	{
		connections[connectionId].sendBinary(data);	
		}
	catch (e)
		{
		console.log(e);
		}	
	};
//** Private methods

sendBinaryCall = function(callId, method, params, connectionId)
	{
	var messageBuffer = new ArrayBuffer(8+4+callId.length+4+method.length+8+params.byteLength);
	var view = new DataView(messageBuffer);
	var messageArray = new Uint8Array(messageBuffer);
	
	view.setUint32(4, messageBuffer.byteLength-8);
	view.setUint32(8, callId.length);
	view.setUint32(8+4+callId.length, method.length);
	
	
	//messageArray.subarray(8+4, 8+4+4+callId.length).set(params);
	//messageArray.subarray(8+4+callId.length+4+method.length+8, messageBuffer.byteLength).set(params);
	
	messageArray.subarray(8+4+callId.length+4+method.length+8, messageBuffer.byteLength).set(params);
	
	
	};

var sendMessage = function(message, connectionId)
	{
	//console.log(message);
	try	{
		connections[connectionId].send(JSON.stringify(message));	
		}
	catch (e)
		{
		console.log(e);
		}	
	};
self.sendMessage = sendMessage;	//for testing, remove this later
// Send the return value of the RPC call to the caller  
var sendResponse = function(err, result, id, connectionId)
	{
	try	{
		if (err)
			{
			sendMessage({"jsonrpc": "2.0", "error": err, "id": id});	
			var code = (typeof err.code != "undefined" ? err.code : "");
			var path = (typeof err.path != "undefined" ? err.path : "");
			var msge = (typeof err.message != "undefined" ? err.message : "");
			console.log("Exception in executing a RPC method: " + code + " EngineIoCommunicator::onMessage() >> " + path + " " + msge);		
			}
		else
			sendMessage({"jsonrpc": "2.0", "result": result, "id": id}, connectionId);
		}
	catch (e)
		{
		console.log(e);
		}		
	};

//Handle incoming RPC call
var handleRPCCall = function(message, connectionId)
	{
	//console.log("RpcCommunicator::handleRpcCall() connectionId "+connectionId);
	try	{
		if ( !message.jsonrpc || message.jsonrpc != "2.0" || !message.method)		// Invalid JSON-RPC
			{
			sendMessage({"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid JSON-RPC."}, "id": null}, connectionId);
			return;
			}
	
		if (Object.prototype.toString.call(message.params) !== "[object Array]" )	
			{
			sendMessage({"jsonrpc": "2.0", "error": {"code": -32602, "message": "Parameters must be sent inside an array."}, "id": message.id}, connectionId);
			return;
			}
	
		if (!exposedRpcMethods.hasOwnProperty(message.method))				// Unknown method
			{
			if (message.id != null)
				{
				sendMessage({"jsonrpc": "2.0", "error": {"code": -32601, "message": "Method " + message.method + " not found."}, "id": message.id}, connectionId);
				return;
				}
			else
				{
				sendMessage({"jsonrpc": "2.0", "error": {"code": -32601, "message": "Method " + message.method + " not found."}, "id": null}, connectionId);
				return;
				}
			}
								// Method exists, call the method 
		var rpcMethod = exposedRpcMethods[message.method];
		
		if (typeof message.params === "undefined")
			message.params = new Array();

		//message.params.unshift(connectionId);	//add connectionId as the first parameter
		//message.params.push(connectionId);	//add connectionId as the last parameter
			
		if (message.id != null)		//It is a call		!!!!!!!!!!!!!!!! ToDO: fix this memory-hog! 
			{
			message.params.push(connectionId);      //add connectionId as the last parameter before callback
			message.params.push(function(err,result) {sendResponse(err,result,message.id, connectionId);});
			
			rpcMethod.method.apply(rpcMethod.object, message.params);
			}
			
		else	
			{					//It is a notification
			message.params.push(connectionId);      //add connectionId as the last parameter before callback
			message.params.push(function(err,result) {});
			rpcMethod.method.apply(rpcMethod.object, message.params);
			}
		}	
	catch (e)
		{
		console.log(e);
		}		
	};

// Handle an incoming return value for a RPC call that we have made previously
var handleReturnValue = function(message)
	{
	console.log(message);
	try	{
		var error = null;
		var result = null;
	
		if (typeof message.error !== "undefined")
			error = message.error;

		if (typeof message.result !== "undefined")
			result = message.result;
	
		if (message.id)
			callbackBuffer.callMethodAndPop(message.id, error, result);
		else
			console.log("RpcCommunicator::handleReturnValue() error: "+JSON.stringify(error));
		}
	catch (e)
		{
		console.log(e);
		}	
	};


var handleMessage = function(message, connectionId)
	{
	try	{
		if (message.method) 			// Received an RPC Call from outside
			handleRPCCall(message, connectionId);
		else										// Received a return value to an RPC call made by us
			handleReturnValue(message);
		}
	catch (e)
		{
		console.log(e);
		}	
	};

var generateRandomConnectionId = function()
	{
	connectionSequence++; 
	var ret = connectionSequence;
	
	while (true)
		{
		ret = Math.floor(Math.random() * 4294967296);	//2 to power 32
		if (!connections.hasOwnProperty(ret))
			break;
		}
		
	return ret;	
	}

var handleBinary = function(data, connectionId)
	{
	var view = new DataView(data);
	var dataArray = new Uint8Array(data);
	
	var messageSize = view.getUint32(4);
	var messageType = view.getUint32(8);
	var idSize = view.getUint32(12);
	
	
	
	var id = dataArray.subarray(16, 16+idSize);
	var idString = String.fromCharCode.apply(null, id);
	
	var methodSize = view.getUint32(16+idSize);
	
	var method = dataArray.subarray(16+idSize+4, 16+idSize+4+methodSize);
	var methodString = String.fromCharCode.apply(null, method);
	
	var paramsSize = view.getUint32( 16+idSize+4+methodSize+4);
	var params = dataArray.subarray(16+idSize+4+methodSize+4+4, 16+idSize+4+methodSize+4+4+paramsSize);
	
	
	console.log("BinaryRpcCommunicator::handleBinary()");
	console.log("id: "+idString+" method:"+methodString)
	}

//** Downwards interface towards a connection

//** MessageListener interface implementation

self.onMessage = function(messageData, connection)
	{
	//console.log("RpcCommunicator::onMessage() "+messageData);

	try	{
		if (messageData instanceof ArrayBuffer)
			{
			//console.log("received arraybuffer ");
			//if (binaryListener)
			//	binaryListener.onBinary(messageData, connection.getId());
			
			handleBinary(messageData, connection.getId());
			return;
			}
	
		var parsedMessage;
		try 
			{
			parsedMessage = JSON.parse(messageData);
			}
		catch (err)
			{
			sendMessage({"jsonrpc": "2.0", "error": {"code": -32700, "message": "Invalid JSON."}, "id": null}, connection.getId());
			return;
			}	
		handleMessage(parsedMessage, connection.getId());
		}
	catch(e)
		{
		console.log(e);
		}	
	};

//** ConnectionListener interface implementation

self.addConnection = function(conn)
	{
	try	{	
		console.log("RpcCommunicator::addConnection, connectionid was "+conn.getId());	
	
		//Use random connectionId to make ddos a little more difficult
		
		if (!conn.getId())
			{
			conn.setId(generateRandomConnectionId());
			}
			
		connections[conn.getId()] = conn;
		conn.setListener(self);	
		
		if (connectionListener)
			{
			connectionListener.listener.call(connectionListener.object, conn.getId());
			}
		
		latestConnectionId = conn.getId();	
		return conn.getId();
		}
	catch(e)
		{
		console.log(e);
		}	
	};
	
self.onDisconnected = function(connectionId)	
	{
	try	{
		self.closeConnection(connectionId);
	
		if (disconnectionListener)
			disconnectionListener.listener.call(disconnectionListener.object, connectionId);
		}
	catch(e)
		{
		console.log(e);
		}	
	};

//** ---------------------------------------

self.closeConnection = function(connectionId)
	{
	try	{
		if (connectionId in connections)
			{
			connections[connectionId].close();
			delete connections[connectionId];

			//if(typeof options.connectionListener == "function")								// External connection listener
			//options.connectionListener("close", {remoteAddress: connection.remoteAddress, remotePort: connection.remotePort, origin: connection.origin, id: connection.id});
			}
		}
	catch(e)
		{
		console.log(e);
		}		
	};

}

// Do this only in node.js, not in the browser

if (typeof exports !== "undefined")
	{
	module.exports = RpcCommunicator;
	}
