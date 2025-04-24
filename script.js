const socket = new WebSocket('wss://videochat-ikzr.onrender.com');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startBtn = document.getElementById('startBtn');
const muteBtn = document.getElementById('muteBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messagesDiv = document.getElementById('messages');
const statusText = document.getElementById('status');
const stickerButtons = document.querySelectorAll('.sticker');

let localStream, remoteStream, peer;
let isMuted = false;
let isInitiator = false;

const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

startBtn.onclick = async () => {
    startBtn.disabled = true;
    statusText.innerText = "Searching for stranger...";
    socket.send(JSON.stringify({ type: 'find' }));
};

muteBtn.onclick = () => {
    if (localStream) {
        isMuted = !isMuted;
        localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
        muteBtn.innerText = isMuted ? 'Unmute' : 'Mute';
    }
};

sendBtn.onclick = sendMessage;

messageInput.oninput = () => {
    socket.send(JSON.stringify({ type: 'typing' }));
};

stickerButtons.forEach(btn => {
    btn.onclick = () => sendSticker(btn.innerText);
});

function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        appendMessage(`You: ${message}`);
        socket.send(JSON.stringify({ type: 'chat', message }));
        messageInput.value = '';
    }
}

function appendMessage(msg) {
    const div = document.createElement('div');
    div.textContent = msg;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function showTypingIndicator() {
    if (!document.getElementById("typing")) {
        const typingDiv = document.createElement("div");
        typingDiv.id = "typing";
        typingDiv.textContent = "Stranger is typing...";
        messagesDiv.appendChild(typingDiv);
        setTimeout(() => typingDiv.remove(), 2000);
    }
}

function sendSticker(emoji) {
    appendMessage(`You sent: ${emoji}`);
    socket.send(JSON.stringify({ type: 'sticker', content: emoji }));
}

socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
        case 'match':
            isInitiator = data.initiator;
            statusText.innerText = "Connected to a stranger!";
            await startCall();
            break;

        case 'offer':
            await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.send(JSON.stringify({ type: 'answer', answer }));
            break;

        case 'answer':
            await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
            break;

        case 'candidate':
            if (peer) await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
            break;

        case 'chat':
            appendMessage(`Stranger: ${data.message}`);
            break;

        case 'typing':
            showTypingIndicator();
            break;

        case 'sticker':
            appendMessage(`Stranger sent: ${data.content}`);
            break;

        case 'leave':
            appendMessage("Stranger has left the chat.");
            remoteVideo.srcObject = null;
            statusText.innerText = "Waiting for connection...";
            break;
    }
};

async function startCall() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    peer = new RTCPeerConnection(config);

    remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;

    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

    peer.ontrack = (e) => remoteStream.addTrack(e.track);
    peer.onicecandidate = (e) => {
        if (e.candidate) {
            socket.send(JSON.stringify({ type: 'candidate', candidate: e.candidate }));
        }
    };

    if (isInitiator) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.send(JSON.stringify({ type: 'offer', offer }));
    }
}
