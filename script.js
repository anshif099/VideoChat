const socket = new WebSocket('wss://your-websocket-server-url'); // Replace with your WebSocket URL
let peer = null;
let localStream = null;
let remoteStream = null;
let initiator = false;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const status = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const disconnectBtn = document.getElementById('disconnectBtn');

socket.onopen = () => {
    console.log('Connected to WebSocket server');
};

socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    console.log('Received message:', data);

    if (data.type === 'match') {
        initiator = data.initiator;
        console.log('Matched! Initiator:', initiator);
        startConnection();
    }

    if (data.type === 'offer') {
        console.log("Received offer from opponent");
        await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.send(JSON.stringify({ type: 'answer', answer }));
    }

    if (data.type === 'answer') {
        console.log("Received answer from opponent");
        await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
    }

    if (data.type === 'candidate') {
        try {
            await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
            console.error('Error adding received ice candidate', err);
        }
    }

    if (data.type === 'disconnect') {
        status.innerText = 'Stranger disconnected.';
        remoteVideo.srcObject = null;
        if (peer) peer.close();
    }
};

async function startConnection() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    peer = new RTCPeerConnection();

    localStream.getTracks().forEach(track => {
        peer.addTrack(track, localStream);
    });

    peer.ontrack = (event) => {
        if (!remoteStream) {
            remoteStream = new MediaStream();
            remoteVideo.srcObject = remoteStream;
        }
        remoteStream.addTrack(event.track);
    };

    peer.onicecandidate = (event) => {
        if (event.candidate) {
            socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        }
    };

    if (initiator) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.send(JSON.stringify({ type: 'offer', offer }));
    }

    status.innerText = 'Connected to stranger.';
    startBtn.style.display = 'none';
    disconnectBtn.style.display = 'inline-block';
}

startBtn.onclick = () => {
    socket.send(JSON.stringify({ type: 'start' }));
    status.innerText = 'Waiting for stranger...';
};

disconnectBtn.onclick = () => {
    socket.send(JSON.stringify({ type: 'disconnect' }));
    status.innerText = 'Disconnected. Waiting for new connection...';
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    startBtn.style.display = 'inline-block';
    disconnectBtn.style.display = 'none';
};
