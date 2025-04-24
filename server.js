const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let waiting = null;

wss.on('connection', (ws) => {
    console.log('A user connected');

    if (waiting === null) {
        waiting = ws;
        ws.partner = null;
    } else {
        // Match users
        ws.partner = waiting;
        waiting.partner = ws;

        ws.send(JSON.stringify({ type: 'match', initiator: true }));
        waiting.send(JSON.stringify({ type: 'match', initiator: false }));

        waiting = null;
    }

    ws.on('message', (msg) => {
        if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
            ws.partner.send(msg);
        }
    });

    ws.on('close', () => {
        if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
            ws.partner.send(JSON.stringify({ type: 'disconnect' }));
            ws.partner.partner = null;
        }

        if (waiting === ws) {
            waiting = null;
        }
    });
});

// Serve static files (for deployment)
app.use(express.static(path.join(__dirname, 'public')));

server.listen(process.env.PORT || 8080, () => {
    console.log('Server running on port 8080');
});
