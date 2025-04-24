const socket = new WebSocket('wss://videochat-ikzr.onrender.com'); // Your WebSocket server
let peer = null;
let localStream = null;
let remoteStream = null;
let initiator = false;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const status = document.getElementById('status');

socket.onopen = () => {
    console.log('Connected to WebSocket server');
};

socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log('Received:', data);

    if (data.type === 'match') {
        initiator = data.initiator;
        console.log('Matched! Initiator:', initiator);
        setupPeer();           // Setup peer first
        getMediaAndStart();    // Then get media and proceed
    }

    if (data.type === 'offer') {
        if (!peer) setupPeer();
        await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.send(JSON.stringify({ type: 'answer', answer }));
    }

    if (data.type === 'answer') {
        if (!peer) setupPeer();
        await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
    }

    if (data.type === 'candidate') {
        if (peer) {
            try {
                await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (err) {
                console.error('Error adding received ICE candidate', err);
            }
        }
    }

    if (data.type === 'disconnect') {
        status.innerText = 'Stranger disconnected.';
        remoteVideo.srcObject = null;
        if (peer) peer.close();
    }
};

function setupPeer() {
    peer = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' } // Public STUN server
        ]
    });

    peer.onicecandidate = (event) => {
        if (event.candidate) {
            socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        }
    };

    peer.ontrack = (event) => {
        console.log('Received remote track');
        if (!remoteStream) {
            remoteStream = new MediaStream();
            remoteVideo.srcObject = remoteStream;
        }
        remoteStream.addTrack(event.track);
    };

    peer.onconnectionstatechange = () => {
        console.log('Connection state:', peer.connectionState);
        if (peer.connectionState === 'connected') {
            status.innerText = 'Connected successfully!';
        }
    };
}

async function getMediaAndStart() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        localStream.getTracks().forEach(track => {
            peer.addTrack(track, localStream);
        });

        if (initiator) {
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            socket.send(JSON.stringify({ type: 'offer', offer }));
        }

        status.innerText = 'Waiting for connection...';

    } catch (err) {
        console.error('Error accessing media devices.', err);
        status.innerText = 'Could not access camera/mic.';
    }
}
document.getElementById('startBtn').onclick = () => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'find' }));
    status.innerText = 'Looking for a stranger...';
  } else {
    status.innerText = 'Socket not connected.';
  }
};

document.getElementById('endBtn').onclick = () => {
  if (peer) peer.close();
  remoteVideo.srcObject = null;
  status.innerText = 'Chat ended.';
  socket.send(JSON.stringify({ type: 'disconnect' }));
};

document.getElementById('newBtn').onclick = () => {
  if (peer) peer.close();
  remoteVideo.srcObject = null;
  status.innerText = 'Finding a new stranger...';
  socket.send(JSON.stringify({ type: 'find' }));
};

