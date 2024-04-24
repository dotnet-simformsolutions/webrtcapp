"use strict";

// Connection to SignalR hub
const connection = new signalR.HubConnectionBuilder()
	.withUrl("/connectionHub")
	.configureLogging(signalR.LogLevel.Information)
	.build();

// Configurations for ICE servers
const configurations = {
	'iceServers': [{
		'urls': ['stun:stun.l.google.com:19302', 'stun:stun2.l.google.com:19302']
	}]
};

// RTC Peer connection with configurations
const peerConnection = new RTCPeerConnection(configurations);

// HTML controls
const roomNameText = document.getElementById('roomNameText');
const createRoomButton = document.getElementById('createRoomButton');
let roomListTable = document.getElementById('roomListTable');
let liveToast = document.getElementById('liveToast');
const connectionStatusMessage = document.getElementById('connectionStatusMessage');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// Local variables
let myRoomId;
let localStream = null;
let isInitiator = false;
let hasRoomJoined = false;
let dataChannel;
let sender;

// Log error utility
const logError = (err) => console.error(err);

// Show toast utility
const showToast = (message) => {
	const toastBody = liveToast.querySelector('.toast-body');
	toastBody.textContent = message;

	const toast = bootstrap.Toast.getOrCreateInstance(liveToast);
	toast.show();
}

// Grab user web cam access
const grabWebCamVideoAndAudio = async () => {
	localStream = await navigator.mediaDevices.getUserMedia({
		audio: true,
		video: true
	});

	// Add local stream to peer connection for remote user and to our local video section
	if (localStream) {
		for (const track of localStream.getTracks()) {
			sender = peerConnection.addTrack(track, localStream);
		}
		localVideo.srcObject = localStream;
	}
}

// Initialize SignalR connection and setup events
const initializeSignalR = async () => {
	try {
		await connection.start();
		console.log("SignalR Connected.");

		// Get room info
		await connection.invoke("GetRoomInfo");

	} catch (err) {
		logError(err);

		// Retry again to initialize
		setTimeout(initializeSignalR, 5000);
	}
};

// On document loaded
document.addEventListener("DOMContentLoaded", async () => {

	// Configuration of data table
	$('#roomListTable').DataTable({
		columns: [
			{ data: 'RoomId', "width": "20%" },
			{ data: 'Name', "width": "50%" },
			{ data: 'Button', "width": "30%" }
		],
		"lengthChange": false,
		"searching": false,
		"language": {
			"emptyTable": "No rooms available"
		}
	});

	// Initialize the signalR connection.
	await initializeSignalR();

	// Initialize the web cam/ video/ audio.
	await grabWebCamVideoAndAudio();
});

// on create a room button click
createRoomButton.addEventListener('click', async () => {
	const roomName = roomNameText.value.trim();

	// If room name is empty
	if (roomName === '') {
		roomNameText.classList.add('is-invalid');
		return;
	}

	// Invoke create room
	try {
		await connection.invoke("CreateRoom", roomName);
	} catch (err) {
		logError(err)
	}
});

// on focus room name text
roomNameText.addEventListener('focus', () => {
	// Remove validation error message on focus
	roomNameText.classList.remove('is-invalid');
});

// on join button click of data table's rows
$('#roomListTable tbody').on('click', 'button', async function () {

	// If user has created a room, or user is already joined the room
	if (hasRoomJoined) {
		showToast(`You have already joined the room. Please use a new tab or window.`);
	} else {
		const data = $('#roomListTable')
			.DataTable()
			.row($(this).parents('tr'))
			.data();

		// Invoke join 
		try {
			await connection.invoke("Join", data.RoomId);
		} catch (err) {
			logError(err)
		}
	}
});

// SignalR connection event handlers
// On update room
connection.on("updateRoom", (jsonData) => {
	// Update the data-table rows with new values
	const data = JSON.parse(jsonData);
	$(roomListTable)
		.DataTable()
		.clear()
		.rows.add(data)
		.draw();
});

// On room created
connection.on('created', (roomId) => {
	showToast(`Room has been created with id: ${roomId}.`);

	roomNameText.value = '';
	roomNameText.disabled = true;
	createRoomButton.disabled = true;

	connectionStatusMessage.innerText = `You have created a room with id: ${roomId}. Waiting for other participants...`;

	hasRoomJoined = true;
	myRoomId = roomId;
	isInitiator = true;
});

// On room joined
connection.on('joined', (roomId) => {
	showToast(`You have successfully joined the room with id: ${roomId}.`);
	myRoomId = roomId;
	isInitiator = false;
});

// On Ready
connection.on('ready', async () => {
	roomNameText.disabled = true;
	createRoomButton.disabled = true;
	connectionStatusMessage.innerText = 'Connecting to remote peer...';

	hasRoomJoined = true;

	// Create the WebRTC peer connection
	try {
		await createPeerConnection(isInitiator, configurations);
	} catch (err) {
		logError(err);
	}
});

// On message
connection.on('message', async (message) => {
	await signalingMessageCallback(message);
});

// On bye
connection.on('bye', async () => {
	connectionStatusMessage.innerText = `Other peer left the room with id: ${myRoomId}.`;

	peerConnection.removeTrack(sender);
	peerConnection.close();
});

// On error
connection.on('error', (message) => {
	logError(message);
});

// On close
connection.onclose(async () => {
	await initializeSignalR();
});

// On window unload
window.addEventListener('unload', async () => {
	if (hasRoomJoined) {
		// If user closes the tab/ browser remove the user from joined room
		try {
			await connection.invoke("LeaveRoom", myRoomId);
		} catch (err) {
			logError(err)
		}
	}
});

// Send message
const sendMessage = async (message) => {
	try {
		await connection.invoke("SendMessage", myRoomId, message);
	} catch (err) {
		logError(err);
	}
}

// WebRTC utility
const createPeerConnection = async (isInitiator, config) => {
	if (isInitiator) {

		// Create the data channel
		dataChannel = await peerConnection.createDataChannel('sendDataChannel');
		onDataChannelCreated(dataChannel);

		// Create the offer for other peer
		const createdOffer = await peerConnection.createOffer();

		// Set the offer as local local description for me
		try {
			await peerConnection.setLocalDescription(createdOffer);
		} catch (err) {
			logError(err);
		}

	} else {
		peerConnection.ondatachannel = (event) => {
			// Set the data channel as created by Initiator or other peer
			dataChannel = event.channel;
			onDataChannelCreated(dataChannel);
		};
	}
};

// send ice candidates to the other peer
peerConnection.onicecandidate = async (event) => {
	if (!event.candidate) {
		await sendMessage(peerConnection.localDescription);
	}
};

// Retrieves the track from remote and add to remote video section
peerConnection.ontrack = (event) => {
	remoteVideo.srcObject = event.streams[0];
};

const onDataChannelCreated = (channel) => {
	channel.onopen = () => {
		connectionStatusMessage.innerText = 'Connection successful.';
	};

	channel.onclose = () => {
		connectionStatusMessage.innerText = 'Connection terminated.';
	}
}

const signalingMessageCallback = async (message) => {
	try {
		if (message.type === 'offer') {

			// Set the offer send by other peer as remote description for me
			await peerConnection.setRemoteDescription(message);

			// Prepare the answer for other peer
			const createdAnswer = await peerConnection.createAnswer();

			// Set the answer prepared for other peer as local description for me
			await peerConnection.setLocalDescription(createdAnswer);

		} else if (message.type === 'answer') {

			// Set the answer send by other peer as remote description
			await peerConnection.setRemoteDescription(message);

		} else if (message.type === 'candidate') {
			await peerConnection.addIceCandidate(new RTCIceCandidate({
				candidate: message.candidate
			}));
		}
	} catch (err) {
		logError(err)
	}
};
