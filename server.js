const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const waitingUsers = [];
const pairs = new Map();

wss.on('connection', (ws) => {
  console.log('New user connected'); // Log when a user connects

  ws.on('message', (message) => {
    console.log('Received message:', message); // Log received messages
    const partner = pairs.get(ws);
    if (partner && partner.readyState === WebSocket.OPEN) {
      partner.send(message);
    }
  });

  ws.on('close', () => {
    console.log('User disconnected'); // Log when a user disconnects

    const partner = pairs.get(ws);
    if (partner && partner.readyState === WebSocket.OPEN) {
      partner.send(JSON.stringify({ type: 'leave' }));
      pairs.delete(partner);
    }

    pairs.delete(ws);

    const index = waitingUsers.indexOf(ws);
    if (index !== -1) waitingUsers.splice(index, 1);

    console.log('User disconnected');
  });

  if (waitingUsers.length > 0) {
    const partner = waitingUsers.pop();

    if (partner.readyState === WebSocket.OPEN) {
      pairs.set(ws, partner);
      pairs.set(partner, ws);

      ws.send(JSON.stringify({ type: 'matched' }));
      partner.send(JSON.stringify({ type: 'matched' }));

      console.log('Users matched');
    } else {
      waitingUsers.push(ws);
    }
  } else {
    waitingUsers.push(ws);
    ws.send(JSON.stringify({ type: 'waiting' }));
  }
});

// Serve everything from the root
app.use(express.static(__dirname));

// Serve index.html for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
