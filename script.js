const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startBtn = document.getElementById('startBtn');
const muteBtn = document.getElementById('muteBtn');
const messageInput = document.getElementById('messageInput');
const messagesDiv = document.getElementById('messages');

let localStream;
let peerConnection;
let isMuted = false;
let matched = false;

const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const socket = new WebSocket('wss://videochat-ikzr.onrender.com');

socket.onopen = () => {
  console.log('Connected to server');
};

socket.onmessage = async (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'matched') {
    matched = true;
    console.log('Matched with stranger!');
    await setupMedia();
    createPeer();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.send(JSON.stringify({ type: 'offer', offer }));
  }

  if (data.type === 'offer') {
    await setupMedia();
    createPeer();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.send(JSON.stringify({ type: 'answer', answer }));
  }

  if (data.type === 'answer') {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
  }

  if (data.type === 'candidate') {
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  }

  if (data.type === 'chat') {
    appendMessage(`Stranger: ${data.message}`);
  }

  if (data.type === 'typing') {
    showTypingIndicator();
  }

  if (data.type === 'sticker') {
    appendMessage(`Stranger sent: ${data.content}`);
  }

  if (data.type === 'leave') {
    appendMessage("Stranger disconnected.");
    remoteVideo.srcObject = null;
  }
};

async function setupMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}

function createPeer() {
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      socket.send(JSON.stringify({ type: 'candidate', candidate }));
    }
  };

  peerConnection.ontrack = ({ streams: [stream] }) => {
    remoteVideo.srcObject = stream;
  };
}

startBtn.onclick = () => {
  if (!matched) {
    socket.send(JSON.stringify({ type: 'join' }));
  }
};

muteBtn.onclick = () => {
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(track => (track.enabled = !isMuted));
  muteBtn.innerText = isMuted ? 'Unmute' : 'Mute';
};

function sendMessage() {
  const message = messageInput.value.trim();
  if (message) {
    appendMessage(`You: ${message}`);
    socket.send(JSON.stringify({ type: 'chat', message }));
    messageInput.value = "";
  }
}

function appendMessage(text) {
  messagesDiv.innerHTML += `<div>${text}</div>`;
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

messageInput.oninput = () => {
  socket.send(JSON.stringify({ type: 'typing' }));
};

function showTypingIndicator() {
  if (!document.getElementById("typing")) {
    const typing = document.createElement("div");
    typing.id = "typing";
    typing.innerText = "Stranger is typing...";
    messagesDiv.appendChild(typing);
    setTimeout(() => {
      const el = document.getElementById("typing");
      if (el) el.remove();
    }, 2000);
  }
}

function sendSticker(emoji) {
  socket.send(JSON.stringify({ type: 'sticker', content: emoji }));
  appendMessage(`You sent: ${emoji}`);
}
