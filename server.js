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
  console.log('New user connected');

  // Match with another user
  if (waitingUsers.length > 0) {
    const partner = waitingUsers.pop();
    pairs.set(ws, partner);
    pairs.set(partner, ws);

    ws.send(JSON.stringify({ type: 'matched' }));
    partner.send(JSON.stringify({ type: 'matched' }));
  } else {
    waitingUsers.push(ws);
  }

  ws.on('message', (message) => {
    const partner = pairs.get(ws);
    if (partner && partner.readyState === WebSocket.OPEN) {
      partner.send(message);
    }
  });

  ws.on('close', () => {
    const partner = pairs.get(ws);
    if (partner && partner.readyState === WebSocket.OPEN) {
      partner.send(JSON.stringify({ type: 'leave' }));
      pairs.delete(partner);
    }

    pairs.delete(ws);
    const index = waitingUsers.indexOf(ws);
    if (index !== -1) waitingUsers.splice(index, 1);
  });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

server.listen(8080, () => {
  console.log('Server running on http://localhost:8080');
});
