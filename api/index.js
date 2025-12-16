const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configure Socket.io for Vercel
const io = socketIo(server, {
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

// Root route - serve index.html
app.get('/', (req, res) => {
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
module.exports = app;

