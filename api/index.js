const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configure Socket.io for Vercel
// Note: WebSockets don't work on Vercel Serverless Functions
// We use polling ONLY - no WebSocket upgrades
const io = socketIo(server, {
    transports: ['polling'], // Only polling - no WebSocket
    allowEIO3: true,
    allowUpgrades: false, // Disable WebSocket upgrades
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    path: '/socket.io/',
    pingTimeout: 60000,
    pingInterval: 25000
});

// Serve static files with proper MIME types - MUST be before other routes
const staticOptions = {
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.css') {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
        } else if (ext === '.js') {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        } else if (ext === '.html') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
    }
};

// Serve static files first (including images)
app.use(express.static(path.join(__dirname, '..'), staticOptions));

// Explicitly serve images directory
app.use('/images', express.static(path.join(__dirname, '..', 'images')));

// Explicit routes for static files to ensure correct MIME types
app.get('/style.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(__dirname, '..', 'style.css'));
});

app.get('/client.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(__dirname, '..', 'client.js'));
});

// Serve socket.io.js from node_modules
app.get('/socket.io/socket.io.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Try different possible paths for socket.io.js
    const possiblePaths = [
        path.join(__dirname, '..', 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'),
        path.join(__dirname, '..', 'node_modules', 'socket.io-client', 'dist', 'socket.io.js'),
        path.join(__dirname, '..', 'node_modules', 'socket.io', 'client', 'dist', 'socket.io.js')
    ];
    
    let sent = false;
    for (const socketIoPath of possiblePaths) {
        try {
            if (require('fs').existsSync(socketIoPath)) {
                res.sendFile(socketIoPath);
                sent = true;
                break;
            }
        } catch (e) {
            // Continue to next path
        }
    }
    
    if (!sent) {
        console.error('Socket.io.js not found in any expected location');
        // Fallback: redirect to CDN
        res.redirect('https://cdn.socket.io/4.6.1/socket.io.min.js');
    }
});

// Socket.io middleware - MUST be before root route
// This handles all Socket.io requests (polling, etc.)
app.use('/socket.io', (req, res, next) => {
    // #region agent log
    const fs = require('fs');
    const logPath = path.join(__dirname, '..', '.cursor', 'debug.log');
    const logEntry = JSON.stringify({
        location: 'api/index.js:root',
        message: 'Socket.io request received',
        data: { method: req.method, url: req.url, path: req.path },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run3',
        hypothesisId: 'F'
    }) + '\n';
    try { fs.appendFileSync(logPath, logEntry); } catch(e) {}
    // #endregion
    
    // Let Socket.io handle the request
    // The server instance will handle Socket.io requests
    next();
});

// Root route - serve index.html
app.get('/', (req, res) => {
    // #region agent log
    const fs = require('fs');
    const logPath = path.join(__dirname, '..', '.cursor', 'debug.log');
    const logEntry = JSON.stringify({
        location: 'api/index.js:root',
        message: 'Root route accessed',
        data: { method: req.method, url: req.url },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run3',
        hypothesisId: 'G'
    }) + '\n';
    try { fs.appendFileSync(logPath, logEntry); } catch(e) {}
    // #endregion
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Game state
const rooms = new Map();

// Generate random room code
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Check for winner
function checkWinner(board) {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
        [0, 4, 8], [2, 4, 6] // diagonals
    ];

    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }

    if (board.every(cell => cell !== '')) {
        return 'draw';
    }

    return null;
}

// Socket connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    const transport = socket.conn?.transport?.name || 'unknown';
    console.log('Connection transport:', transport);
    
    // #region agent log
    const fs = require('fs');
    const logPath = path.join(__dirname, '..', '.cursor', 'debug.log');
    const logEntry = JSON.stringify({
        location: 'api/index.js:54',
        message: 'User connected',
        data: { socketId: socket.id, transport: transport },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'D'
    }) + '\n';
    try { fs.appendFileSync(logPath, logEntry); } catch(e) {}
    // #endregion

    socket.on('createRoom', ({ playerName }) => {
        const roomCode = generateRoomCode();
        const room = {
            code: roomCode,
            players: [{ id: socket.id, name: playerName, symbol: 'X' }],
            board: ['', '', '', '', '', '', '', '', ''],
            currentTurn: 'X',
            status: 'waiting'
        };
        
        rooms.set(roomCode, room);
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode });
        io.to(roomCode).emit('playerJoined', { playerCount: room.players.length });
        
        console.log(`Room created: ${roomCode} by ${playerName}`);
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms.get(roomCode);
        
        if (!room) {
            socket.emit('roomNotFound');
            return;
        }

        if (room.players.length >= 2) {
            socket.emit('roomFull');
            return;
        }

        room.players.push({ id: socket.id, name: playerName, symbol: 'O' });
        socket.join(roomCode);
        socket.emit('roomJoined', { roomCode });
        
        io.to(roomCode).emit('playerJoined', { playerCount: room.players.length });

        if (room.players.length === 2) {
            room.status = 'playing';
            setTimeout(() => {
                // Send gameStart to each player with their own symbol
                room.players.forEach((player, index) => {
                    io.to(player.id).emit('gameStart', {
                        players: room.players,
                        currentTurn: room.currentTurn,
                        yourSymbol: player.symbol,
                        yourPlayerIndex: index
                    });
                });
            }, 1000);
        }
    });

    socket.on('makeMove', ({ roomCode, index, player }) => {
        const room = rooms.get(roomCode);
        
        if (!room || room.status !== 'playing') {
            return;
        }

        // Validate move
        if (room.board[index] !== '' || room.currentTurn !== player) {
            return;
        }

        // Make move
        room.board[index] = player;
        
        // Check for winner
        const winner = checkWinner(room.board);
        
        if (winner) {
            room.status = 'finished';
            io.to(roomCode).emit('gameOver', {
                board: room.board,
                winner: winner
            });
        } else {
            // Switch turn
            room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
            io.to(roomCode).emit('moveMade', {
                board: room.board,
                currentTurn: room.currentTurn
            });
        }
    });

    socket.on('resetGame', ({ roomCode }) => {
        const room = rooms.get(roomCode);
        
        if (!room) {
            return;
        }

        room.board = ['', '', '', '', '', '', '', '', ''];
        room.currentTurn = 'X';
        room.status = 'playing';
        
        io.to(roomCode).emit('gameReset');
        // Send gameStart to each player with their own symbol
        room.players.forEach((player, index) => {
            io.to(player.id).emit('gameStart', {
                players: room.players,
                currentTurn: room.currentTurn,
                yourSymbol: player.symbol,
                yourPlayerIndex: index
            });
        });
    });

    socket.on('leaveRoom', ({ roomCode }) => {
        const room = rooms.get(roomCode);
        
        if (room) {
            room.players = room.players.filter(p => p.id !== socket.id);
            
            if (room.players.length === 0) {
                rooms.delete(roomCode);
            } else {
                io.to(roomCode).emit('playerLeft');
                // Reset room if game was in progress
                if (room.status === 'playing') {
                    room.board = ['', '', '', '', '', '', '', '', ''];
                    room.currentTurn = 'X';
                    room.status = 'waiting';
                }
            }
        }
        
        socket.leave(roomCode);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Remove player from all rooms
        for (const [code, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                
                if (room.players.length === 0) {
                    rooms.delete(code);
                } else {
                    io.to(code).emit('playerLeft');
                    if (room.status === 'playing') {
                        room.board = ['', '', '', '', '', '', '', '', ''];
                        room.currentTurn = 'X';
                        room.status = 'waiting';
                    }
                }
                break;
            }
        }
    });
});

// Export for Vercel
// Vercel Serverless Functions work differently - we need to export the app
// Socket.io should work through the Express app
module.exports = app;

