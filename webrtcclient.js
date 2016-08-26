"use strict"

navigator.getUserMedia = (navigator.getUserMedia || 
                          navigator.webkitGetUserMedia || 
                          navigator.mozGetUserMedia || 
                          navigator.msGetUserMedia);

function WebRtcClient(serverAddress, rtcConfig)
{
var self = this;

var connection = new WebSocketConnection();
var communicator = new RpcCommunicator();

var rtcConnections = new Object();
var ownStream = null;
var connectionListener = null;

	
self.setConnectionListener = function(lis)
	{
	connectionListener = lis;
	}

self.onIceCandidate = function(iceCandidate, partnerId)
	{
	console.log("iceCandidate got, sending it to the other client");
	communicator.callRpc("offerIce", [iceCandidate, partnerId]);
	};
	
var createConnection = function(partnerId)
	{
	rtcConnections[partnerId]= new WebRtcConnection(rtcConfig);
	rtcConnections[partnerId].setPartnerId(partnerId);
	
	rtcConnections[partnerId].setIceListener(self);
	rtcConnections[partnerId].setStreamListener(self);
	rtcConnections[partnerId].setConnectionListener(self);
	rtcConnections[partnerId].setDataChannelListener(self);
	}



self.shutdown = function(e)
	{
	console.log("WebRtcClient::onbeforeunload");
	for (var id in rtcConnections)
		{
		if (rtcConnections.hasOwnProperty(id))
			{
			rtcConnections[id].close();
			delete rtcConnections[id];
			}
		}
	}



// RPC methods

self.handleRtcOffer = function(descriptor, partnerId, connectionId)
	{
	console.log("WebRtcClient::handleRtcOffer() descriptor: "+descriptor);
	
	if (!rtcConnections.hasOwnProperty(partnerId))
		{
		createConnection(partnerId);
		}
		
	rtcConnections[partnerId].onConnectionOfferReceived(descriptor, connectionId, function(answer)
		{
		console.log("WebRtcClient::handleRtcOffer() onConnectionOfferReceived returned");
		communicator.callRpc("acceptConnectionOffer",[answer, partnerId]);
		});
	
	};	

self.handleRtcAnswer = function(descriptor, partnerId, connectionId)
	{
	console.log("WebRtcClient::handleRtcAnswer()");			
	rtcConnections[partnerId].onConnectionAnswerReceived(descriptor);
	};	

self.handleIceCandidate = function(iceCandidate, partnerId, connectionId)
	{
	console.log("WebRtcClient::handleIceCandidate()");			
	
		
	if (!rtcConnections.hasOwnProperty(partnerId))
		{
		createConnection(partnerId);
		}
		
	rtcConnections[partnerId].onIceCandidateReceived(iceCandidate);
	};


	


	
// Private methods
	
var connectToCoordinator = function(callback)
	{
	console.log("WebRtcClient::connectToCoordinator()");
	console.log("Websocket connecting to the coordinator");

	connection.connect(serverAddress, function()
			{
			console.log("Websocket Connected to the Coordinator");	
			console.log("Creating RPCCommunicator for the Websocket");
							
			communicator.addConnection(connection);
			callback(); 
			});
	};

self.onDisconnected = function(partnerId)
	{
	console.log("WebRtcClient::onDisconnected() ");
	if (rtcConnections.hasOwnProperty(partnerId))
		{
		var connection = rtcConnections[partnerId]; 	
		connectionListener.onDisconnected(connection.getId());
	
		connection.close();
		delete rtcConnections[partnerId];
		}
	};

self.onDataChannelOpen = function(connection)
	{
	console.log("WebRtcClient::onDataChannelOpen() ");
	connectionListener.addConnection(connection);
	};
							
self.onStream = function(stream, partnerId)
	{
	console.log("WebRtcClient::onStream()");
	};
	
self.onRemoveStream = function(stream, partnerId)
	{
	console.log("WebRtcClient::onRemoveStream()");
	self.onDisconnected(partnerId);
	};
	
var connectToPeers = function(announceId, callback)
	{
	console.log("WebRtcClient::connectToPeers()");				
	console.log("Announcing to the Coordinator");		
					
	communicator.callRpc("announce", [announceId], self, self.onPeerIdsArrived);									
	};	


//Callback of the connectToPeers RPC call

self.onPeerIdsArrived = function(err, data, id)
	{
	console.log("WebRtcClient::onPeerIdsArrived(), data.length: "+data.length);
	var partnerId = 0;
	
	for (var i=0; i<data.length; i++)	
		{
		partnerId = data[i];
		
		//Create a WebRTC connection and 
		
		createConnection(partnerId);
		
		console.log("Trying to create offer to client id " + partnerId);
		
		//Creating a connection offer 
		
		rtcConnections[partnerId].createConnectionOffer(function(offer, peerId)
			{
			console.log("Offer created, sending it to the other client "+peerId);
			communicator.callRpc("offerConnection", [offer, peerId]);	
			});					
		}
	if (data.length === 0)
		console.log("Announce returned 0 client ids, not connecting");	
	};
	
self.run = function(announceId, callback)
	{
	console.log("WebRtcClient::run()");
	
	window.onbeforeunload = self.shutdown;	
	
	communicator.exposeRpcMethod("handleRtcOffer", self, self.handleRtcOffer);
	communicator.exposeRpcMethod("handleRtcAnswer", self, self.handleRtcAnswer);
	communicator.exposeRpcMethod("handleIceCandidate", self, self.handleIceCandidate);
	
	
    connectToCoordinator(function() 
		{
		console.log("WebRtcClient::run() connected to the coordinator");		
		connectToPeers(announceId, function()
			{
			console.log("WebRtcClient::run() connectToPeers returned");
			});
		if (callback)	
			callback(communicator);
		}); 
        	
	};			
}

if (typeof exports !== "undefined")
	{
	module.exports = WebRtcClient;	
	}