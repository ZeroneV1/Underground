const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors()); // Allow requests from other origins
app.use(express.json()); // Allow server to read JSON from requests

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// --- Data Persistence ---
// We will store the total user count in a file on a Render Disk.
// Render Disks are mounted at a specific path, here we use '/data'.
const DATA_DIR = process.env.RENDER_DISK_MOUNT_PATH || 'data';
const DATA_FILE = path.join(DATA_DIR, 'data.json');

// Ensure the data directory exists
if (!fs.existsSync(DATA_DIR)){
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Function to read data from the file
function readData() {
    if (!fs.existsSync(DATA_FILE)) {
        return { totalUsers: 0 };
    }
    const rawData = fs.readFileSync(DATA_FILE);
    return JSON.parse(rawData);
}

// Function to write data to the file
function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let data = readData();

// --- WebSocket Logic for Live Users ---
wss.on('connection', (ws) => {
    // A new user connected, broadcast the new count to everyone
    broadcastLiveUsers();

    ws.on('close', () => {
        // A user disconnected, broadcast the new count
        broadcastLiveUsers();
    });

    ws.on('error', console.error);
});

function broadcastLiveUsers() {
    const liveUsers = wss.clients.size;
    const message = JSON.stringify({ type: 'liveUsers', count: liveUsers });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// --- API Endpoints for Total Users ---
app.get('/api/stats', (req, res) => {
    res.json({
        totalUsers: data.totalUsers,
        liveUsers: wss.clients.size
    });
});

app.post('/api/increment-total', (req, res) => {
    data.totalUsers++;
    writeData(data);
    res.status(200).json({ success: true, totalUsers: data.totalUsers });
});

// --- Serve your HTML file ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'ground home.html'));
});

// --- Start the Server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
