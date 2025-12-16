// Initialize socket with better error handling
const socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
});

let playerName = '';
let roomCode = '';
let currentPlayer = null;
let isMyTurn = false;
let gameBoard = ['', '', '', '', '', '', '', '', ''];
let gameStatus = 'waiting'; // waiting, playing, finished

// DOM Elements
const lobbyScreen = document.getElementById('lobby');
const waitingScreen = document.getElementById('waiting');
const gameScreen = document.getElementById('game');
const playerNameInput = document.getElementById('playerName');
const roomCodeInput = document.getElementById('roomCode');
const roomCodeGroup = document.getElementById('roomCodeGroup');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const joinBtn = document.getElementById('joinBtn');
const cancelWaitBtn = document.getElementById('cancelWaitBtn');
const leaveGameBtn = document.getElementById('leaveGameBtn');
const resetGameBtn = document.getElementById('resetGameBtn');
const displayRoomCode = document.getElementById('displayRoomCode');
const gameRoomCode = document.getElementById('gameRoomCode');
const playerCount = document.getElementById('playerCount');
const turnMessage = document.getElementById('turnMessage');
const lobbyMessage = document.getElementById('lobbyMessage');
const gameMessage = document.getElementById('gameMessage');
const board = document.getElementById('board');
const cells = document.querySelectorAll('.cell');

// Event Listeners
createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', showRoomCodeInput);
joinBtn.addEventListener('click', joinRoom);
cancelWaitBtn.addEventListener('click', cancelWaiting);
leaveGameBtn.addEventListener('click', leaveGame);
resetGameBtn.addEventListener('click', resetGame);

// Cell click handlers
cells.forEach(cell => {
    cell.addEventListener('click', () => {
        const index = parseInt(cell.dataset.index);
        if (isMyTurn && !cell.classList.contains('filled') && gameStatus === 'playing') {
            makeMove(index);
        } else if (!isMyTurn && gameStatus === 'playing') {
            updateMessage(gameMessage, 'Nicht dein Zug!', 'error');
            setTimeout(() => {
                if (gameMessage.textContent === 'Nicht dein Zug!') {
                    gameMessage.textContent = '';
                    gameMessage.className = 'message';
                }
            }, 1500);
        }
    });
});

// Socket Events
socket.on('connect', () => {
    console.log('Connected to server');
    updateMessage(lobbyMessage, 'Mit Server verbunden!', 'success');
    setTimeout(() => {
        lobbyMessage.textContent = '';
        lobbyMessage.className = 'message';
    }, 2000);
});

socket.on('connect_error', () => {
    updateMessage(lobbyMessage, 'Verbindungsfehler! Bitte Seite neu laden.', 'error');
});

socket.on('roomCreated', (data) => {
    roomCode = data.roomCode;
    displayRoomCode.textContent = roomCode;
    gameRoomCode.textContent = roomCode;
    showScreen('waiting');
    updateMessage(lobbyMessage, `Raum erstellt! Code: ${roomCode}`, 'success');
});

socket.on('roomJoined', (data) => {
    roomCode = data.roomCode;
    gameRoomCode.textContent = roomCode;
    updateMessage(lobbyMessage, `Raum beigetreten: ${roomCode}`, 'success');
});

socket.on('roomFull', () => {
    updateMessage(lobbyMessage, 'Raum ist bereits voll!', 'error');
    showScreen('lobby');
});

socket.on('roomNotFound', () => {
    updateMessage(lobbyMessage, 'Raum nicht gefunden!', 'error');
    showScreen('lobby');
});

socket.on('playerJoined', (data) => {
    playerCount.textContent = `${data.playerCount}/2`;
    if (data.playerCount === 2) {
        updateMessage(lobbyMessage, 'Gegner beigetreten! Spiel startet...', 'success');
    }
});

socket.on('gameStart', (data) => {
    currentPlayer = data.yourSymbol; // X or O
    updatePlayers(data.players, data.yourPlayerIndex);
    gameStatus = 'playing';
    showScreen('game');
    updateTurn(data.currentTurn);
    updateMessage(gameMessage, 'Spiel gestartet!', 'success');
    setTimeout(() => {
        gameMessage.textContent = '';
        gameMessage.className = 'message';
    }, 2000);
});

socket.on('moveMade', (data) => {
    updateBoard(data.board);
    updateTurn(data.currentTurn);
    checkGameStatus(data);
});

socket.on('gameOver', (data) => {
    gameStatus = 'finished';
    updateBoard(data.board);
    isMyTurn = false;
    
    if (data.winner === currentPlayer) {
        updateMessage(gameMessage, '🎉 Du hast gewonnen!', 'success');
    } else if (data.winner === 'draw') {
        updateMessage(gameMessage, 'Unentschieden!', 'info');
    } else {
        updateMessage(gameMessage, 'Du hast verloren!', 'error');
    }
    
    resetGameBtn.style.display = 'block';
    disableBoard();
});

socket.on('playerLeft', () => {
    updateMessage(lobbyMessage, 'Gegner hat das Spiel verlassen!', 'error');
    showScreen('lobby');
    initGame();
});

socket.on('gameReset', () => {
    initGame();
    updateMessage(gameMessage, 'Neues Spiel gestartet!', 'success');
    setTimeout(() => {
        gameMessage.textContent = '';
        gameMessage.className = 'message';
    }, 2000);
});

socket.on('disconnect', () => {
    updateMessage(lobbyMessage, 'Verbindung zum Server verloren!', 'error');
    if (gameStatus === 'playing') {
        showScreen('lobby');
        initGame();
    }
});

// Functions
function createRoom() {
    playerName = playerNameInput.value.trim();
    if (!playerName) {
        updateMessage(lobbyMessage, 'Bitte gib deinen Namen ein!', 'error');
        return;
    }
    updateMessage(lobbyMessage, 'Erstelle Raum...', 'info');
    socket.emit('createRoom', { playerName });
}

function showRoomCodeInput() {
    playerName = playerNameInput.value.trim();
    if (!playerName) {
        updateMessage(lobbyMessage, 'Bitte gib deinen Namen ein!', 'error');
        return;
    }
    roomCodeGroup.style.display = 'flex';
    roomCodeInput.focus();
}

function joinRoom() {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!code || code.length !== 6) {
        updateMessage(lobbyMessage, 'Bitte gib einen gültigen 6-stelligen Code ein!', 'error');
        return;
    }
    if (!playerName) {
        updateMessage(lobbyMessage, 'Bitte gib zuerst deinen Namen ein!', 'error');
        return;
    }
    socket.emit('joinRoom', { roomCode: code, playerName });
    updateMessage(lobbyMessage, 'Verbinde mit Raum...', 'info');
}

function cancelWaiting() {
    if (roomCode) {
        socket.emit('leaveRoom', { roomCode });
    }
    showScreen('lobby');
    initGame();
}

function leaveGame() {
    if (roomCode) {
        socket.emit('leaveRoom', { roomCode });
    }
    showScreen('lobby');
    initGame();
}

function resetGame() {
    socket.emit('resetGame', { roomCode });
}

function makeMove(index) {
    if (gameBoard[index] !== '' || !isMyTurn || gameStatus !== 'playing') {
        return;
    }
    // Visual feedback
    const cell = cells[index];
    cell.style.opacity = '0.5';
    setTimeout(() => {
        cell.style.opacity = '1';
    }, 200);
    
    socket.emit('makeMove', { roomCode, index, player: currentPlayer });
    // Temporarily disable board to prevent double clicks
    disableBoard();
}

function updateBoard(board) {
    gameBoard = board;
    cells.forEach((cell, index) => {
        const value = board[index];
        cell.textContent = value;
        cell.classList.remove('x', 'o', 'filled');
        if (value === 'X') {
            cell.classList.add('x', 'filled');
        } else if (value === 'O') {
            cell.classList.add('o', 'filled');
        }
    });
}

function updateTurn(currentTurn) {
    isMyTurn = currentTurn === currentPlayer;
    const player1El = document.getElementById('player1');
    const player2El = document.getElementById('player2');
    
    player1El.classList.remove('active');
    player2El.classList.remove('active');
    
    if (currentTurn === 'X') {
        player1El.classList.add('active');
        turnMessage.textContent = isMyTurn ? 'Du bist dran!' : 'Gegner ist dran...';
    } else {
        player2El.classList.add('active');
        turnMessage.textContent = isMyTurn ? 'Du bist dran!' : 'Gegner ist dran...';
    }
    
    if (!isMyTurn) {
        disableBoard();
    } else {
        enableBoard();
    }
}

function updatePlayers(players, yourIndex) {
    const player1El = document.getElementById('player1');
    const player2El = document.getElementById('player2');
    
    if (players.length > 0) {
        const name1 = players[0].name || 'Spieler 1';
        player1El.querySelector('.player-name').textContent = yourIndex === 0 ? `${name1} (Du)` : name1;
    }
    if (players.length > 1) {
        const name2 = players[1].name || 'Spieler 2';
        player2El.querySelector('.player-name').textContent = yourIndex === 1 ? `${name2} (Du)` : name2;
    }
}

function checkGameStatus(data) {
    if (data.winner) {
        gameStatus = 'finished';
        isMyTurn = false;
        disableBoard();
        
        if (data.winner === currentPlayer) {
            updateMessage(gameMessage, '🎉 Du hast gewonnen!', 'success');
        } else if (data.winner === 'draw') {
            updateMessage(gameMessage, 'Unentschieden!', 'info');
        } else {
            updateMessage(gameMessage, 'Du hast verloren!', 'error');
        }
        
        resetGameBtn.style.display = 'block';
    }
}

function disableBoard() {
    cells.forEach(cell => {
        if (!cell.classList.contains('filled')) {
            cell.classList.add('disabled');
        }
    });
}

function enableBoard() {
    cells.forEach(cell => {
        cell.classList.remove('disabled');
    });
}

function showScreen(screenName) {
    lobbyScreen.classList.remove('active');
    waitingScreen.classList.remove('active');
    gameScreen.classList.remove('active');
    
    if (screenName === 'lobby') {
        lobbyScreen.classList.add('active');
    } else if (screenName === 'waiting') {
        waitingScreen.classList.add('active');
    } else if (screenName === 'game') {
        gameScreen.classList.add('active');
    }
}

function updateMessage(element, message, type) {
    element.textContent = message;
    element.className = `message ${type}`;
}

// Initialize - reset local state only
function initGame() {
    gameBoard = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = null;
    isMyTurn = false;
    gameStatus = 'waiting';
    roomCode = '';
    updateBoard(gameBoard);
    resetGameBtn.style.display = 'none';
}

// Initialize on page load
initGame();

