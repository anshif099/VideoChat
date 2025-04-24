const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

let waitingClient = null;

wss.on('connection', (ws) => {
    console.log('New client connected');
    
    // Wait for the first client to connect
    if (waitingClient) {
        // Match both clients
        ws.send(JSON.stringify({ type: 'match', initiator: false }));
        waitingClient.send(JSON.stringify({ type: 'match', initiator: true }));
        waitingClient = null;
    } else {
        waitingClient = ws;
        ws.send(JSON.stringify({ type: 'waiting' }));
    }

    // Relay messages between clients
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'offer' || data.type === 'answer' || data.type === 'candidate') {
            waitingClient.send(message);
        }

        if (data.type === 'disconnect') {
            if (waitingClient) waitingClient.send(JSON.stringify({ type: 'disconnect' }));
        }
    });

    // Handle client disconnections
    ws.on('close', () => {
        console.log('Client disconnected');
        if (waitingClient === ws) waitingClient = null;
    });
});

console.log('WebSocket server is running on ws://localhost:8080');
