const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startBtn = document.getElementById('startBtn');
const muteBtn = document.getElementById('muteBtn');
const messageInput = document.getElementById('messageInput');
const messagesDiv = document.getElementById('messages');

let localStream;
let peerConnection;
let isMuted = false;

const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const socket = new WebSocket('ws://localhost:8080');

startBtn.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  peerConnection = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.onicecandidate = ({ candidate }) => {
    if (candidate) socket.send(JSON.stringify({ type: 'candidate', candidate }));
  };

  peerConnection.ontrack = ({ streams: [stream] }) => {
    remoteVideo.srcObject = stream;
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.send(JSON.stringify({ type: 'offer', offer }));
};

muteBtn.onclick = () => {
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
  muteBtn.innerText = isMuted ? 'Unmute' : 'Mute';
};

function sendMessage() {
  const message = messageInput.value;
  if (message.trim() !== "") {
    appendMessage(`You: ${message}`);
    socket.send(JSON.stringify({ type: 'chat', message }));
    messageInput.value = "";
  }
}

function appendMessage(text) {
  messagesDiv.innerHTML += `<div>${text}</div>`;
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

socket.onmessage = async (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'offer') {
    await receiveOffer(data.offer);
  } else if (data.type === 'answer') {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
  } else if (data.type === 'candidate') {
    peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  } else if (data.type === 'chat') {
    appendMessage(`Stranger: ${data.message}`);
  }
};

async function receiveOffer(offer) {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  peerConnection = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.onicecandidate = ({ candidate }) => {
    if (candidate) socket.send(JSON.stringify({ type: 'candidate', candidate }));
  };

  peerConnection.ontrack = ({ streams: [stream] }) => {
    remoteVideo.srcObject = stream;
  };

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.send(JSON.stringify({ type: 'answer', answer }));
}
messageInput.oninput = () => {
  socket.send(JSON.stringify({ type: 'typing' }));
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'typing') {
    // Show typing message for 2 sec
    showTypingIndicator();
  }
};

function showTypingIndicator() {
  if (!document.getElementById("typing")) {
    messagesDiv.innerHTML += `<div id="typing">Stranger is typing...</div>`;
    setTimeout(() => {
      const el = document.getElementById("typing");
      if (el) el.remove();
    }, 2000);
  }
}
// ... Keep existing video + message logic

messageInput.oninput = () => {
  socket.send(JSON.stringify({ type: 'typing' }));
};

function sendSticker(emoji) {
  socket.send(JSON.stringify({ type: 'sticker', content: emoji }));
  appendMessage(`You sent: ${emoji}`);
}

// Inside socket.onmessage
if (data.type === 'typing') {
  showTypingIndicator();
} else if (data.type === 'sticker') {
  appendMessage(`Stranger sent: ${data.content}`);
} else if (data.type === 'leave') {
  appendMessage("Stranger has left the chat.");
  remoteVideo.srcObject = null;
}
