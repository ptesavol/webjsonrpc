"use strict";


     		
function WebRtcConnection(rtcConfig)
{
var RTCPeerConnection = null;
var RTCSessionDescription = null;
var RTCIceCandidate = null;

if (typeof window == "undefined")
	{
	RTCPeerConnection = global.RTCPeerConnection;
	RTCSessionDescription = global.RTCSessionDescription;
	RTCIceCandidate = global.RTCIceCandidate;
	}
else
	{	
	RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
	RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
	RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
    }


var self = this;
var id = null;
var partnerId = null;
var iceListener = null;
var streamListener = null;
var dataChannelListener = null;
var connectionListener = null;
var ownStream = null;
var listener = null;

var rtcOptions = { 'optional': [{'DtlsSrtpKeyAgreement': true}] };

var peerConnection = new RTCPeerConnection(rtcConfig, rtcOptions);

var dataChannel = null; 

// If we receive a data channel from somebody else, this gets called

peerConnection.ondatachannel = function (e) 
	{
    var temp = e.channel || e; // Chrome sends event, FF sends raw channel
    console.log("ondatachannel "+e);
    dataChannel = temp;
    dataChannel.binaryType = "arraybuffer";
    dataChannel.onopen = self.onDataChannelOpen;
	dataChannel.onmessage = self.onMessage;
	};


var onsignalingstatechange = function(state) 
	{
    console.info('signaling state change:', state);
	//if ( connectionListener && peerConnection.signalingState == "closed")
	//	connectionListener.onDisconnected(partnerId);
	}

var oniceconnectionstatechange = function(state) 
	{
    console.info('ice connection state change:', state);
   	if ( connectionListener && (peerConnection.iceConnectionState == "disconnected" || peerConnection.iceConnectionState == "closed"))
		connectionListener.onDisconnected(partnerId);
	};

var onicegatheringstatechange = function(state) 
	{
    console.info('ice gathering state change:', state);
	};

var onIceCandidate = function(e)	
	{
	console.log("WebRtcConnection::onIceCanditate() partnerId: "+partnerId+" event: "+ e);
	
	console.log("iceListener oli "+iceListener);
	
	//A null ice canditate means that all canditates have
    //been given
	
	if (e.candidate == null) 
    	{
        console.log("All Ice candidates listed");
    	//iceListener.onIceCandidate(peerConnection.localDescription, partnerId);
    	}
    else
    	{	
    	iceListener.onIceCandidate(e.candidate, partnerId);
		}
	};

peerConnection.onsignalingstatechange = onsignalingstatechange;
peerConnection.oniceconnectionstatechange = oniceconnectionstatechange;
peerConnection.onicegatheringstatechange = onicegatheringstatechange;
peerConnection.onicecandidate = onIceCandidate;

self.close = function()
	{
	console.log("WebRtcConnection::close");	
	//peerConnection.removeStream(ownStream);
	   
	
	//if (dataChannel && dataChannel.readyState != "closing" && dataChannel.readyState != "closed")
	//	dataChannel.close();
	
	if (peerConnection.signalingState != "closed" || peerConnection.signalingState != "closing")
		peerConnection.close();
	}

self.send = function(message)
	{
	try	{
		if (dataChannel.readyState == "open")
			dataChannel.send(message);
		}
	catch(e)
		{
		console.log(e);
		}	
	};

self.getBufferedAmount = function()
	{
	return dataChannel.bufferedAmount;
	};
	
self.sendBinary = function(data)
	{
	try	{
		if (dataChannel.readyState == "open")
			dataChannel.send(data);
		}
	catch(e)
		{
		console.log(e);
		}	
	};

self.onDataChannelClosed = function(e)
	{
	console.log("WebRtcConnection::onDataChannelClosed "+e);
	connectionListener.onDisconnected(self);
	}
	
self.onDataChannelOpen = function(e)
	{
	console.log("WebRtcConnection::onDataChannelOpen "+e);
	dataChannel.binaryType = "arraybuffer";
	dataChannel.onclose = self.onDataChannelClosed;
	dataChannel.onmessage = self.onMessage;
	if (dataChannelListener)
		dataChannelListener.onDataChannelOpen(self);
	}
	
self.onMessage = function(message)	
	{
	//console.log("WebRtcConnection::onMessage "+message.data);
	try	{
		if (listener)
			listener.onMessage(message.data, self);
		}
	catch (e)
		{
		console.log(e);
		}	
	};



self.setId = function(id_)
	{
	id = id_;
	//console.log("WebRtcConnection::setId() "+id);
	};

self.getId = function()
	{
	//console.log("WebRtcConnection::getId() "+id);
	return id;
	};
	
self.getPartnerId = function()
	{
	//console.log("WebRtcConnection::getPartnerId() "+partnerId);
	return partnerId;
	};
					
self.setPartnerId = function(id_)
	{
	partnerId = id_;
	};

self.setDataChannelListener = function(lis)
	{
	dataChannelListener = lis;
	};

self.setListener = function(lis)
	{
	listener = lis;
	};


self.setIceListener = function(lis)
	{
	iceListener = lis;
	//peerConnection.onicecandidate = function(cand) {self.onIceCandidate(cand);};
	console.log("WebRtcConnection::setIceListener()"+ lis);
	};

self.setStreamListener = function(lis)
	{
	streamListener = lis;
	peerConnection.onaddstream = function(e) {self.onStream(e);};
	peerConnection.onremovestream = function(e) {self.onRemoveStream(e);};
	};
	
self.setConnectionListener = function(lis)
	{
	connectionListener = lis;
	//peerConnection.onaddstream = function(e) {self.onStream(e);};
	};	
	

self.onStream = function(e)
	{	
	console.log("WebRtcConnection::onStream"+ e);
	streamListener.onStream(e.stream, partnerId);
	}
	
self.onRemoveStream = function(e)
	{	
	console.log("WebRtcConnection::onStream"+ e);
	streamListener.onRemoveStream(e.stream, partnerId);
	}

self.addStream = function(stream)
	{
	ownStream = stream;
	peerConnection.addStream(stream);
	}

self.createConnectionOffer = function(callback)
	{
	var localDescription = null;
	
	dataChannel = peerConnection.createDataChannel("jsonrpcchannel", {reliable: true});
	dataChannel.binaryType = "arraybuffer";
	dataChannel.onopen = self.onDataChannelOpen;
	dataChannel.onmessage = self.onMessage;
			
	peerConnection.createOffer(function (desc)
		{
		console.log("peerConnection::createOffer called its callback: "+ desc);
    	localDescription = desc;
    	
    	/*
    	peerConnection.onicecandidate = function(e)
    		{
    		console.log(e.candidate);
    		if (e.candidate == null) 
    			{
        		console.log("All Ice candidates listed");
    			//iceListener.onIceCandidate(peerConnection.localDescription, partnerId);
    			callback(peerConnection.localDescription, partnerId);
    			}
    		};
    	*/
    	
    	peerConnection.setLocalDescription(desc, function() 
    								{
    								callback(peerConnection.localDescription, partnerId);
    								},
    								function(err)
    									{
    									console.log("WebRtcConnection::createConnectionOffer() setLocalDescription error");
    									},								
    								{});
    	},function(err) {console.log(err);}); 
    };	

//Interface for messages coming from the partner ove websocket

self.onConnectionAnswerReceived = function(descriptor)
	{
	console.log("WebRtcConnection::onConnectionAnswerReceived(), descriptor: "+descriptor);
	
	peerConnection.setRemoteDescription(new RTCSessionDescription(descriptor),function()
		{
		console.log("WebRtcConnection::onConnectionAnswerReceived() setRemoteDescription returned OK");
		}, 
		function(err) 
			{console.log("WebRtcConnection::onConnectionAnswerReceived() setRemoteDescription returned error "+err);}  );
	
	};
	
	
self.onConnectionOfferReceived = function(descriptor, connectionId, callback)
	{
	console.log("WebRtcConnection::onConnectionOfferReceived");
	
	console.log("WebRtcConnection::onConnectionOfferReceived trying to set remote description");	
	var desc = new RTCSessionDescription(descriptor);
	peerConnection.setRemoteDescription(desc, function() 
		{
		console.log("WebRtcConnection::onConnectionOfferReceived remote description set");
		peerConnection.createAnswer(function (answer) 
				{
				/*
				peerConnection.onicecandidate = function(e)
    				{
    				if (e.candidate == null) 
    					{
        				console.log("All Ice candidates listed");
    					//iceListener.onIceCandidate(peerConnection.localDescription, partnerId);
    					callback(peerConnection.localDescription);
    					}
    				};
				*/
				peerConnection.setLocalDescription(answer, function () 
					{
					callback(peerConnection.localDescription);
					//callback(answer);
					}, 
					function(err) { console.log(err); } 
					);
				},
				function(err) { console.log(err); }
				);	
		}, function(err) {console.log("WebRtcConnection::onConnectionOfferReceived setting remote description failed "+err);}
		
		);
	
	};
	
self.onIceCandidateReceived = function(iceCandidate)
	{	
	peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate),
            function () {console.log("WebRtcConnection::onIceCandidateReceived adding Ice candidate succeeded");},  
            function(err) {console.log("WebRtcConnection::onIceCandidateReceived adding Ice candidate failed "+err);});
	};         	

// Dummy implementation for websocket compatibility

self.setPipedTo = function(targetId)
	{
	};
	
self.getPipedTo = function()
	{
	return null;
	};	
	
}

if (typeof exports !== "undefined")
	{
	module.exports = WebRtcConnection;	
	}