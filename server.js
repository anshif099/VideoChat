const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

let waitingClient = null;

wss.on('connection', (ws) => {
    console.log('New client connected');
    
    // When a client connects, try to match them with another one
    if (waitingClient) {
        // If a second client joins, we match both of them
        ws.send(JSON.stringify({ type: 'match', initiator: false }));
        waitingClient.send(JSON.stringify({ type: 'match', initiator: true }));
        waitingClient = null;
    } else {
        waitingClient = ws;
        ws.send(JSON.stringify({ type: 'waiting' }));
    }

    // Listen for messages from the client
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'offer' || data.type === 'answer' || data.type === 'candidate') {
            // Forward the signaling messages (offer, answer, candidate) to the other client
            if (waitingClient) {
                waitingClient.send(message);
            }
        }

        if (data.type === 'disconnect') {
            // Notify the other client if one disconnects
            if (waitingClient) {
                waitingClient.send(JSON.stringify({ type: 'disconnect' }));
            }
        }
    });

    // Handle when a client disconnects
    ws.on('close', () => {
        console.log('Client disconnected');
        if (waitingClient === ws) waitingClient = null;
    });
});

console.log('WebSocket server is running on ws://localhost:8080');
