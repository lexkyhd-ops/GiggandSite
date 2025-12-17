// Initialize socket with better error handling
// Render supports WebSockets, so we can use both transports
const socket = io({
    transports: ['websocket', 'polling'], // WebSocket first, fallback to polling
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 20000,
    forceNew: false
});


let playerName = '';
let roomCode = '';
let currentPlayer = null;
let isMyTurn = false;
let gameBoard = ['', '', '', '', '', '', '', '', ''];
let gameStatus = 'waiting'; // waiting, playing, finished
let playerScores = { X: 0, O: 0 }; // Track wins for each player

// Single background image
const backgroundImages = ['images/giggand2.png'];
let currentBackgroundImage = backgroundImages[0];

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
    const transport = socket.io.engine?.transport?.name || 'unknown';
    console.log('Transport:', transport);
    
    
    if (transport === 'polling') {
        updateMessage(lobbyMessage, 'Mit Server verbunden (Polling-Modus)!', 'success');
    } else {
        updateMessage(lobbyMessage, 'Mit Server verbunden!', 'success');
    }
    
    setTimeout(() => {
        lobbyMessage.textContent = '';
        lobbyMessage.className = 'message';
    }, 2000);
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    const transport = socket.io.engine?.transport?.name || 'unknown';
    
    
    updateMessage(lobbyMessage, 'Verbindungsfehler! Versuche erneut...', 'error');
    // Auto-retry after 3 seconds
    setTimeout(() => {
        if (!socket.connected) {
            socket.connect();
        }
    }, 3000);
});

socket.on('reconnect_attempt', () => {
    console.log('Reconnection attempt...');
    
    
    updateMessage(lobbyMessage, 'Verbindung wird wiederhergestellt...', 'info');
});

socket.on('reconnect', () => {
    console.log('Reconnected!');
    const transport = socket.io.engine?.transport?.name || 'unknown';
    
    
    updateMessage(lobbyMessage, 'Verbindung wiederhergestellt!', 'success');
    setTimeout(() => {
        lobbyMessage.textContent = '';
        lobbyMessage.className = 'message';
    }, 2000);
});

socket.on('reconnect_failed', () => {
    updateMessage(lobbyMessage, 'Verbindung fehlgeschlagen. Bitte Seite neu laden.', 'error');
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
    console.log('gameStart received:', data);
    currentPlayer = data.yourSymbol; // X or O
    window.testMode = data.testMode || false; // Store test mode flag
    console.log('Game started - My symbol:', currentPlayer, 'Current turn:', data.currentTurn, 'Players:', data.players, 'Test mode:', window.testMode);
    
    if (!currentPlayer) {
        console.error('ERROR: currentPlayer is not set!', data);
        return;
    }
    
    // Update scores from server (synchronized)
    if (data.scores) {
        playerScores = { ...data.scores };
        updateScores();
    }
    
    // Set random background image for the board
    currentBackgroundImage = backgroundImages[Math.floor(Math.random() * backgroundImages.length)];
    // Small delay to ensure DOM is ready
    setTimeout(() => {
        updateBoardBackground();
    }, 100);
    
    updatePlayers(data.players, data.yourPlayerIndex);
    gameStatus = 'playing';
    showScreen('game');
    
    // Reset board state to ensure clean start
    gameBoard = ['', '', '', '', '', '', '', '', ''];
    updateBoard(gameBoard);
    
    // Update turn AFTER currentPlayer is set
    if (data.currentTurn) {
        updateTurn(data.currentTurn);
    } else {
        console.warn('No currentTurn in gameStart data');
        turnMessage.textContent = 'Warte auf Spielstart...';
    }
    
    // In test mode, update message
    if (window.testMode) {
        turnMessage.textContent = 'Test-Modus: Du kannst beide Spieler steuern!';
    }
    
    // Clear any previous game over messages and re-enable board
    resetGameBtn.style.display = 'none';
    enableBoard();
    
    updateMessage(gameMessage, 'Spiel gestartet!', 'success');
    setTimeout(() => {
        gameMessage.textContent = '';
        gameMessage.className = 'message';
    }, 2000);
});

socket.on('moveMade', (data) => {
    updateBoard(data.board);
    
    // In test mode, switch currentPlayer to match the current turn so player can control both
    if (window.testMode && data.currentTurn) {
        currentPlayer = data.currentTurn;
        // Update UI to show which symbol we're playing as
        const players = [
            {name: playerName, symbol: 'X'},
            {name: 'Bot (Test)', symbol: 'O'}
        ];
        const playerIndex = currentPlayer === 'X' ? 0 : 1;
        updatePlayers(players, playerIndex);
    }
    
    updateTurn(data.currentTurn);
    checkGameStatus(data);
});

socket.on('gameOver', (data) => {
    gameStatus = 'finished';
    updateBoard(data.board);
    isMyTurn = false;
    
    // Update scores from server (synchronized)
    if (data.scores) {
        playerScores = { ...data.scores };
    } else if (data.winner && data.winner !== 'draw') {
        // Fallback: update locally if server doesn't send scores
        playerScores[data.winner] = (playerScores[data.winner] || 0) + 1;
    }
    updateScores();
    
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
    // Reset board state but keep currentPlayer and scores - it will be set again in gameStart
    gameBoard = ['', '', '', '', '', '', '', '', ''];
    isMyTurn = false;
    gameStatus = 'waiting'; // Will be set to 'playing' in gameStart
    updateBoard(gameBoard);
    resetGameBtn.style.display = 'none';
    enableBoard(); // Re-enable board for new game
    updateMessage(gameMessage, 'Neues Spiel wird gestartet...', 'info');
    // gameStart event will follow and set everything correctly
    // Scores are preserved across games
});

socket.on('disconnect', () => {
    updateMessage(lobbyMessage, 'Verbindung zum Server verloren!', 'error');
    if (gameStatus === 'playing') {
        showScreen('lobby');
        initGame();
    }
});

// Functions
function createRoom(event) {
    playerName = playerNameInput.value.trim();
    if (!playerName) {
        updateMessage(lobbyMessage, 'Bitte gib deinen Namen ein!', 'error');
        return;
    }
    // Check if Shift key is held for test mode
    const testMode = event && event.shiftKey;
    updateMessage(lobbyMessage, testMode ? 'Erstelle Raum im Test-Modus...' : 'Erstelle Raum...', 'info');
    socket.emit('createRoom', { playerName, testMode: testMode });
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
    if (gameBoard[index] !== '' || gameStatus !== 'playing') {
        return;
    }
    
    // In test mode, allow moves for both players
    // Otherwise, check if it's my turn
    if (!window.testMode && !isMyTurn) {
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
        // Remove all classes that might affect interaction
        cell.classList.remove('x', 'o', 'filled', 'disabled');
        if (value === 'X') {
            cell.classList.add('x', 'filled');
        } else if (value === 'O') {
            cell.classList.add('o', 'filled');
        }
    });
    // After updating board, update turn state to enable/disable correctly
    if (gameStatus === 'playing' && currentPlayer) {
        // Turn state will be updated by updateTurn, but ensure board is in correct state
        // This will be handled by updateTurn being called after updateBoard
    }
}

function updateTurn(currentTurn) {
    if (!currentPlayer) {
        console.warn('updateTurn called but currentPlayer is not set');
        return;
    }
    
    isMyTurn = currentTurn === currentPlayer;
    console.log('Update turn - Current turn:', currentTurn, 'My symbol:', currentPlayer, 'Is my turn:', isMyTurn);
    
    const player1El = document.getElementById('player1');
    const player2El = document.getElementById('player2');
    
    player1El.classList.remove('active');
    player2El.classList.remove('active');
    
    // In test mode, always enable board and allow both players
    if (window.testMode) {
        if (currentTurn === 'X') {
            player1El.classList.add('active');
            turnMessage.textContent = `Test-Modus: ${currentTurn} ist dran (du steuerst beide)`;
        } else if (currentTurn === 'O') {
            player2El.classList.add('active');
            turnMessage.textContent = `Test-Modus: ${currentTurn} ist dran (du steuerst beide)`;
        }
        // Always enable board in test mode
        if (gameStatus === 'playing') {
            enableBoard();
        }
    } else {
        if (currentTurn === 'X') {
            player1El.classList.add('active');
            turnMessage.textContent = isMyTurn ? 'Du bist dran!' : 'Gegner ist dran...';
        } else if (currentTurn === 'O') {
            player2El.classList.add('active');
            turnMessage.textContent = isMyTurn ? 'Du bist dran!' : 'Gegner ist dran...';
        } else {
            turnMessage.textContent = 'Warte auf Spielstart...';
        }
        
        // Enable/disable board based on turn
        if (gameStatus === 'playing') {
            if (!isMyTurn) {
                disableBoard();
            } else {
                enableBoard();
            }
        } else {
            // If game is not playing, disable board
        disableBoard();
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
    
    // Update scores display
    updateScores();
}

function updateScores() {
    const player1ScoreEl = document.getElementById('player1Score');
    const player2ScoreEl = document.getElementById('player2Score');
    
    if (player1ScoreEl) {
        player1ScoreEl.textContent = playerScores.X || 0;
    }
    if (player2ScoreEl) {
        player2ScoreEl.textContent = playerScores.O || 0;
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
        // Only disable cells that are not filled
        if (!cell.classList.contains('filled')) {
            cell.classList.add('disabled');
        }
    });
}

function enableBoard() {
    cells.forEach(cell => {
        // Only enable cells that are not filled
        if (!cell.classList.contains('filled')) {
            cell.classList.remove('disabled');
        }
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
    playerScores = { X: 0, O: 0 }; // Reset scores when leaving game
    updateBoard(gameBoard);
    resetGameBtn.style.display = 'none';
    updateScores();
}

// Update board background image with coordinate mapping
function updateBoardBackground() {
    const board = document.getElementById('board');
    if (board) {
        // Preload image to check if it exists and get dimensions
        const img = new Image();
        img.onload = () => {
            console.log('Background image loaded:', currentBackgroundImage);
            const imgWidth = img.width;
            const imgHeight = img.height;
            console.log('Image dimensions:', imgWidth, 'x', imgHeight);
            
            // Coordinates from user: P1(401,133), P2(135,336), P3(395,345), P4(159,141)
            // Get board dimensions
            const boardRect = board.getBoundingClientRect();
            const boardWidth = boardRect.width;
            const boardHeight = boardRect.height;
            console.log('Board dimensions:', boardWidth, 'x', boardHeight);
            
            // Calculate scale factor to show full image while mapping coordinates to board
            // Find the bounding box of the coordinates
            const minX = Math.min(159, 401, 135, 395);
            const maxX = Math.max(159, 401, 135, 395);
            const minY = Math.min(141, 133, 336, 345);
            const maxY = Math.max(141, 133, 336, 345);
            const coordWidth = maxX - minX;
            const coordHeight = maxY - minY;
            
            // Calculate scale to fit full image in board while maintaining aspect ratio
            // We want the full image to be visible, so we use contain logic
            const imageAspect = imgWidth / imgHeight;
            const boardAspect = boardWidth / boardHeight;
            
            let scale;
            let scaledImgWidth, scaledImgHeight;
            let offsetX, offsetY;
            
            // Scale image to be very large (50x the board size)
            const scaleMultiplier = 50; // Make image 50x larger than board
            
            if (imageAspect > boardAspect) {
                // Image is wider - scale to be much larger than width
                scale = (boardWidth * scaleMultiplier) / imgWidth;
                scaledImgWidth = boardWidth * scaleMultiplier;
                scaledImgHeight = imgHeight * scale;
                offsetX = (boardWidth - scaledImgWidth) / 2;
                offsetY = (boardHeight - scaledImgHeight) / 2;
            } else {
                // Image is taller - scale to be much larger than height
                scale = (boardHeight * scaleMultiplier) / imgHeight;
                scaledImgWidth = imgWidth * scale;
                scaledImgHeight = boardHeight * scaleMultiplier;
                offsetX = (boardWidth - scaledImgWidth) / 2;
                offsetY = (boardHeight - scaledImgHeight) / 2;
            }
            
            console.log('Image scale calculation:', {
                imageAspect,
                boardAspect,
                scale,
                scaledImgWidth,
                scaledImgHeight,
                offsetX,
                offsetY
            });
            
            // Now calculate where the coordinates should be positioned
            // The coordinates are in original image pixels, convert to board coordinates
            const coordScaleX = scaledImgWidth / imgWidth;
            const coordScaleY = scaledImgHeight / imgHeight;
            
            // Convert coordinates to percentages relative to board
            // Coordinates are in original image pixels, scale them to board coordinates
            const p1x = ((401 * coordScaleX + offsetX) / boardWidth) * 100;
            const p1y = ((133 * coordScaleY + offsetY) / boardHeight) * 100;
            const p2x = ((135 * coordScaleX + offsetX) / boardWidth) * 100;
            const p2y = ((336 * coordScaleY + offsetY) / boardHeight) * 100;
            const p3x = ((395 * coordScaleX + offsetX) / boardWidth) * 100;
            const p3y = ((345 * coordScaleY + offsetY) / boardHeight) * 100;
            const p4x = ((159 * coordScaleX + offsetX) / boardWidth) * 100;
            const p4y = ((141 * coordScaleY + offsetY) / boardHeight) * 100;
            
            console.log('Calculated clip-path coordinates:', {p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y});
            
            // Create clip-path polygon from coordinates (top-left P4, top-right P1, bottom-right P3, bottom-left P2)
            const clipPath = `polygon(${p4x}% ${p4y}%, ${p1x}% ${p1y}%, ${p3x}% ${p3y}%, ${p2x}% ${p2y}%)`;
            
            // Directly set the background image on the board element
            // Show full image without clipping - the board border will contain it
            const style = document.createElement('style');
            style.textContent = `
                .board::before {
                    background-image: url('${currentBackgroundImage}') !important;
                    background-position: ${offsetX}px ${offsetY}px !important;
                    background-size: ${scaledImgWidth}px ${scaledImgHeight}px !important;
                    opacity: 1 !important;
                    -webkit-background-size: ${scaledImgWidth}px ${scaledImgHeight}px !important;
                    -moz-background-size: ${scaledImgWidth}px ${scaledImgHeight}px !important;
                    -o-background-size: ${scaledImgWidth}px ${scaledImgHeight}px !important;
                    /* Show full image - no clipping */
                    clip-path: none !important;
                    -webkit-clip-path: none !important;
                }
                .board {
                    background-image: url('${currentBackgroundImage}') !important;
                    background-position: ${offsetX}px ${offsetY}px !important;
                    background-size: ${scaledImgWidth}px ${scaledImgHeight}px !important;
                    -webkit-background-size: ${scaledImgWidth}px ${scaledImgHeight}px !important;
                    -moz-background-size: ${scaledImgWidth}px ${scaledImgHeight}px !important;
                    -o-background-size: ${scaledImgWidth}px ${scaledImgHeight}px !important;
                    /* Show full image - no clipping */
                    clip-path: none !important;
                    -webkit-clip-path: none !important;
                }
            `;
            // Remove old style if exists
            const oldStyle = document.getElementById('board-bg-style');
            if (oldStyle) oldStyle.remove();
            style.id = 'board-bg-style';
            document.head.appendChild(style);
            
            // Also set directly on element for mobile compatibility
            board.style.backgroundImage = `url('${currentBackgroundImage}')`;
            board.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
            board.style.backgroundSize = `${scaledImgWidth}px ${scaledImgHeight}px`;
            board.style.clipPath = clipPath;
            board.style.webkitClipPath = clipPath;
        };
        img.onerror = () => {
            console.error('Failed to load background image:', currentBackgroundImage);
        };
        img.src = currentBackgroundImage;
    }
}

// Initialize on page load
initGame();

// Set initial background image when page loads
window.addEventListener('load', () => {
    setTimeout(() => {
        updateBoardBackground();
    }, 200);
});

// Update background when window resizes
window.addEventListener('resize', () => {
    setTimeout(() => {
        updateBoardBackground();
    }, 100);
});

// Update version display
document.addEventListener('DOMContentLoaded', () => {
    const versionEl = document.getElementById('version');
    if (versionEl) {
        versionEl.textContent = '1.7.0';
    }
});

