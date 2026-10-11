const socket = io();

// =========================
// НАЛАШТУВАННЯ
// =========================

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const opponentCanvas = document.getElementById("opponentCanvas");
const opponentCtx = opponentCanvas.getContext("2d");

// =========================
// СТАН
// =========================

let playerName = "";
let roomCode = "";

let gameRunning = false;
let paused = false;

let board = [];
let score = 0;
let lines = 0;
let level = 1;

let opponentBoard = [];
let currentPiece = null;

let dropCounter = 0;
let lastTime = 0;
let dropInterval = 800;

let gameMode = "multiplayer";

// =========================
// ФІГУРИ
// =========================

const pieces = [
    { shape: [[1, 1, 1, 1]], color: "#00ffff" },
    { shape: [[1, 1], [1, 1]], color: "#ffff00" },
    { shape: [[0, 1, 0], [1, 1, 1]], color: "#aa55ff" },
    { shape: [[0, 1, 1], [1, 1, 0]], color: "#55ff55" },
    { shape: [[1, 1, 0], [0, 1, 1]], color: "#ff5555" },
    { shape: [[1, 0, 0], [1, 1, 1]], color: "#5588ff" },
    { shape: [[0, 0, 1], [1, 1, 1]], color: "#ff9955" }
];

// =========================
// DOM
// =========================

const lobby = document.getElementById("lobby");
const roomPanel = document.getElementById("roomPanel");
const gamePanel = document.getElementById("gamePanel");

const playerNameInput = document.getElementById("playerName");
const roomInput = document.getElementById("roomCode");

const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const soloBtn = document.getElementById("soloBtn");

const startBtn = document.getElementById("startBtn");
const leaveBtn = document.getElementById("leaveBtn");
const restartBtn = document.getElementById("restartBtn");
const backBtn = document.getElementById("backBtn");

const errorText = document.getElementById("errorText");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const roomStatus = document.getElementById("roomStatus");

const myNameText = document.getElementById("myName");
const opponentNameText = document.getElementById("opponentName");

const scoreText = document.getElementById("score");
const linesText = document.getElementById("lines");
const levelText = document.getElementById("level");

const opponentScoreText = document.getElementById("opponentScore");
const opponentLinesText = document.getElementById("opponentLines");
const opponentLevelText = document.getElementById("opponentLevel");

const recordsBody = document.getElementById("recordsBody");

const gameOver = document.getElementById("gameOver");
const gameOverTitle = document.getElementById("gameOverTitle");
const gameOverText = document.getElementById("gameOverText");

// =========================
// ДОПОМІЖНІ ФУНКЦІЇ
// =========================

function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function randomPiece() {
    const source = pieces[Math.floor(Math.random() * pieces.length)];

    return {
        shape: source.shape.map(row => [...row]),
        color: source.color,
        x: Math.floor(COLS / 2 - source.shape[0].length / 2),
        y: 0
    };
}

function showError(message) {
    errorText.textContent = message;

    setTimeout(() => {
        errorText.textContent = "";
    }, 4000);
}

// =========================
// ВІДОБРАЖЕННЯ СУПЕРНИКА
// =========================

function setOpponentVisible(visible) {
    document.body.classList.toggle("solo-mode", !visible);

    const element = document.getElementById("opponentCanvas");
    if (!element) return;

    let column = element.closest(".gameColumn");

    if (!column) {
        column = element.parentElement;

        while (
            column &&
            column.parentElement &&
            column.parentElement !== document.body
        ) {
            if (column.classList && column.classList.contains("boards")) {
                break;
            }

            column = column.parentElement;
        }
    }

    if (column) {
        column.style.display = visible ? "" : "none";
    }
}

// =========================
// СТВОРЕННЯ КІМНАТИ
// =========================

createBtn.onclick = () => {
    gameMode = "multiplayer";
    setOpponentVisible(true);

    playerName = playerNameInput.value.trim() || "Гравець";

    socket.emit("create_room", { name: playerName });
};

joinBtn.onclick = () => {
    gameMode = "multiplayer";
    setOpponentVisible(true);

    playerName = playerNameInput.value.trim() || "Гравець";
    roomCode = roomInput.value.trim().toUpperCase();

    if (!roomCode) {
        showError("Введи код кімнати.");
        return;
    }

    socket.emit("join_room_game", {
        name: playerName,
        room: roomCode
    });
};

if (soloBtn) {
    soloBtn.onclick = () => {
        gameMode = "solo";
        roomCode = "";
        playerName = playerNameInput.value.trim() || "Гравець";

        setOpponentVisible(false);

        lobby.classList.add("hidden");
        roomPanel.classList.add("hidden");
        gamePanel.classList.remove("hidden");

        startGame();
    };
}

socket.on("room_created", data => {
    roomCode = data.room;
    openRoom();
});

socket.on("room_joined", data => {
    roomCode = data.room;
    openRoom();
});

function openRoom() {
    lobby.classList.add("hidden");
    roomPanel.classList.remove("hidden");

    roomCodeDisplay.textContent = roomCode;
    myNameText.textContent = playerName;

    updateRoomButtons();
}

function updateRoomButtons() {
    const cards = document.querySelectorAll(".playerCard");

    if (cards.length) {
        // Залишаємо інтерфейс стабільним.
    }
}

socket.on("room_update", data => {
    const players = data.players;

    if (players.length === 1) {
        roomStatus.textContent = "Очікуємо другого гравця...";
        opponentNameText.textContent = "Очікування...";
        startBtn.disabled = true;
    }

    if (players.length === 2) {
        roomStatus.textContent = "Готово! Можна починати.";

        const opponent = players.find(p => p.id !== socket.id);

        if (opponent) {
            opponentNameText.textContent = opponent.name;
        }

        startBtn.disabled = false;
    }
});

socket.on("error_message", data => {
    showError(data.message);
});

// =========================
// СТАРТ МУЛЬТИПЛЕЄРА
// =========================

startBtn.onclick = () => {
    socket.emit("start_match", { room: roomCode });
};

socket.on("match_started", () => {
    gameMode = "multiplayer";
    setOpponentVisible(true);

    roomPanel.classList.add("hidden");
    gamePanel.classList.remove("hidden");

    startGame();
});

// =========================
// ГРА
// =========================

function startGame() {
    board = createBoard();
    opponentBoard = createBoard();

    score = 0;
    lines = 0;
    level = 1;

    dropInterval = 800;
    dropCounter = 0;
    paused = false;
    gameRunning = true;

    currentPiece = randomPiece();

    updateStats();
    closeGameOver();
    draw();

    lastTime = performance.now();

    requestAnimationFrame(gameLoop);

    sendGameState();
}

function gameLoop(time = 0) {
    if (!gameRunning) return;

    const delta = time - lastTime;
    lastTime = time;

    if (!paused) {
        dropCounter += delta;

        if (dropCounter > dropInterval) {
            moveDown();
            dropCounter = 0;
        }

        draw();
    }

    requestAnimationFrame(gameLoop);
}

// =========================
// ЗІТКНЕННЯ
// =========================

function collision(piece, testBoard = board) {
    for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
            if (!piece.shape[y][x]) continue;

            const boardX = piece.x + x;
            const boardY = piece.y + y;

            if (
                boardX < 0 ||
                boardX >= COLS ||
                boardY >= ROWS
            ) {
                return true;
            }

            if (
                boardY >= 0 &&
                testBoard[boardY] &&
                testBoard[boardY][boardX]
            ) {
                return true;
            }
        }
    }

    return false;
}

// =========================
// РУХ ФІГУР
// =========================

function moveLeft() {
    if (!gameRunning || paused || !currentPiece) return;

    currentPiece.x--;

    if (collision(currentPiece)) {
        currentPiece.x++;
    }

    draw();
}

function moveRight() {
    if (!gameRunning || paused || !currentPiece) return;

    currentPiece.x++;

    if (collision(currentPiece)) {
        currentPiece.x--;
    }

    draw();
}

function moveDown() {
    if (!gameRunning || paused || !currentPiece) return;

    currentPiece.y++;

    if (collision(currentPiece)) {
        currentPiece.y--;

        merge();
        clearLines();

        currentPiece = randomPiece();

        if (
            collision(currentPiece) ||
            board.slice(0, 3).some(row => row.some(cell => cell))
        ) {
            loseGame();
            return;
        }

        sendGameState();
    }

    dropCounter = 0;
    draw();
}

function hardDrop() {
    if (!gameRunning || paused || !currentPiece) return;

    while (!collision(currentPiece)) {
        currentPiece.y++;
    }

    currentPiece.y--;

    merge();
    clearLines();

    currentPiece = randomPiece();

    if (collision(currentPiece)) {
        loseGame();
        return;
    }

    sendGameState();
    draw();
}

// =========================
// ОБЕРТАННЯ
// =========================

function rotatePiece() {
    if (!gameRunning || paused || !currentPiece) return;

    const oldShape = currentPiece.shape.map(row => [...row]);

    const rows = currentPiece.shape.length;
    const cols = currentPiece.shape[0].length;

    const rotated = [];

    for (let x = 0; x < cols; x++) {
        rotated[x] = [];

        for (let y = rows - 1; y >= 0; y--) {
            rotated[x].push(currentPiece.shape[y][x]);
        }
    }

    currentPiece.shape = rotated;

    if (collision(currentPiece)) {
        currentPiece.shape = oldShape;
    }

    draw();
}

// =========================
// ЗЛИТТЯ ФІГУРИ З ПОЛЕМ
// =========================

function merge() {
    let blocksPlaced = 0;

    currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (!value) return;

            const boardY = currentPiece.y + y;
            const boardX = currentPiece.x + x;

            if (
                boardY >= 0 &&
                boardY < ROWS &&
                boardX >= 0 &&
                boardX < COLS
            ) {
                board[boardY][boardX] = currentPiece.color;
                blocksPlaced++;
            }
        });
    });

    score += blocksPlaced * 10;

    updateStats();
}

// =========================
// ОЧИЩЕННЯ ЛІНІЙ
// =========================

function clearLines() {
    let cleared = 0;

    outer:
    for (let y = ROWS - 1; y >= 0; y--) {
        for (let x = 0; x < COLS; x++) {
            if (!board[y][x]) continue outer;
        }

        board.splice(y, 1);
        board.unshift(Array(COLS).fill(0));

        cleared++;
        y++;
    }

    if (cleared > 0) {
        const points = [0, 100, 300, 500, 800];

        score += (points[cleared] || 800) * level;
        lines += cleared;

        level = Math.floor(lines / 10) + 1;

        dropInterval = Math.max(
            100,
            800 - (level - 1) * 60
        );

        updateStats();
    }
}

// =========================
// ПРОГРАШ
// =========================

function loseGame() {
    gameRunning = false;

    if (gameMode === "multiplayer" && roomCode) {
        socket.emit("player_lost", { room: roomCode });
    }

    saveRecord();

    showGameOver(
        "💀 Ти програв!",
        `Твій рахунок: ${score}`
    );
}

// =========================
// ПЕРЕМОГА
// =========================

socket.on("opponent_won", () => {
    if (!gameRunning) return;

    gameRunning = false;

    saveRecord();

    showGameOver(
        "🏆 Ти переміг!",
        `Твій рахунок: ${score}`
    );
});

// =========================
// СТАН СУПЕРНИКА
// =========================

socket.on("opponent_state", data => {
    opponentBoard = data.board || [];

    opponentScoreText.textContent = data.score || 0;
    opponentLevelText.textContent = data.level || 1;
    opponentLinesText.textContent = data.lines || 0;

    drawOpponent();
});

// =========================
// СТАТИСТИКА
// =========================

function updateStats() {
    scoreText.textContent = score;
    linesText.textContent = lines;
    levelText.textContent = level;
}

// =========================
// МАЛЮВАННЯ
// =========================

function drawBoard(context, targetBoard) {
    context.clearRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "#050812";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "rgba(255,255,255,0.05)";
    context.lineWidth = 1;

    for (let x = 0; x <= COLS; x++) {
        context.beginPath();
        context.moveTo(x * BLOCK, 0);
        context.lineTo(x * BLOCK, ROWS * BLOCK);
        context.stroke();
    }

    for (let y = 0; y <= ROWS; y++) {
        context.beginPath();
        context.moveTo(0, y * BLOCK);
        context.lineTo(COLS * BLOCK, y * BLOCK);
        context.stroke();
    }

    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (targetBoard[y] && targetBoard[y][x]) {
                drawBlock(context, x, y, targetBoard[y][x]);
            }
        }
    }
}

function drawBlock(context, x, y, color) {
    context.fillStyle = color;

    context.fillRect(
        x * BLOCK + 1,
        y * BLOCK + 1,
        BLOCK - 2,
        BLOCK - 2
    );

    context.strokeStyle = "rgba(255,255,255,0.3)";

    context.strokeRect(
        x * BLOCK + 2,
        y * BLOCK + 2,
        BLOCK - 4,
        BLOCK - 4
    );
}

function drawPiece() {
    if (!currentPiece) return;

    currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                drawBlock(
                    ctx,
                    currentPiece.x + x,
                    currentPiece.y + y,
                    currentPiece.color
                );
            }
        });
    });
}

function draw() {
    drawBoard(ctx, board);
    drawPiece();

    const endLineY = 3 * BLOCK;

    ctx.save();

    ctx.beginPath();
    ctx.moveTo(0, endLineY);
    ctx.lineTo(COLS * BLOCK, endLineY);

    ctx.strokeStyle = "#ff1744";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#ff1744";
    ctx.shadowBlur = 12;

    ctx.stroke();
    ctx.restore();
}

function drawOpponent() {
    drawBoard(opponentCtx, opponentBoard);
}

// =========================
// КЕРУВАННЯ КЛАВІАТУРОЮ
// =========================

document.addEventListener("keydown", event => {
    if (!gameRunning) return;

    if ([
        "ArrowLeft",
        "ArrowRight",
        "ArrowDown",
        "ArrowUp",
        "Space"
    ].includes(event.code)) {
        event.preventDefault();
    }

    if (event.code === "ArrowLeft") {
        moveLeft();
    } else if (event.code === "ArrowRight") {
        moveRight();
    } else if (event.code === "ArrowDown") {
        moveDown();
    } else if (event.code === "ArrowUp") {
        rotatePiece();
    } else if (event.code === "Space") {
        hardDrop();
    } else if (event.key.toLowerCase() === "p") {
        paused = !paused;
    }
});

// =========================
// СЕНСОРНЕ КЕРУВАННЯ ЖЕСТАМИ
// =========================

// Приховуємо старі сенсорні кнопки, якщо вони існують.
const oldTouchControls = document.getElementById("touchControls");

if (oldTouchControls) {
    oldTouchControls.hidden = true;
    oldTouchControls.style.display = "none";
}

if (canvas) {
    canvas.style.touchAction = "none";
    canvas.style.userSelect = "none";
    canvas.style.webkitUserSelect = "none";

    const SWIPE_START = 18;
    const MOVE_STEP = 24;
    const DOWN_STEP = 28;

    let swipe = null;

    canvas.addEventListener("contextmenu", event => {
        event.preventDefault();
    });

    canvas.addEventListener("pointerdown", event => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        if (!gameRunning || paused || !currentPiece) {
            return;
        }

        event.preventDefault();

        swipe = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            lastX: event.clientX,
            lastY: event.clientY,
            axis: null,
            rotated: false
        };

        try {
            canvas.setPointerCapture(event.pointerId);
        } catch (_) {
            // Захоплення вказівника може бути недоступним.
        }
    });

    canvas.addEventListener("pointermove", event => {
        if (!swipe || event.pointerId !== swipe.pointerId) {
            return;
        }

        if (!gameRunning || paused) {
            return;
        }

        event.preventDefault();

        const totalX = event.clientX - swipe.startX;
        const totalY = event.clientY - swipe.startY;

        // Визначаємо напрямок жесту.
        if (!swipe.axis) {
            if (
                Math.max(
                    Math.abs(totalX),
                    Math.abs(totalY)
                ) < SWIPE_START
            ) {
                return;
            }

            swipe.axis =
                Math.abs(totalX) > Math.abs(totalY)
                    ? "x"
                    : "y";
        }

        // Свайп ліворуч або праворуч.
        if (swipe.axis === "x") {
            let deltaX = event.clientX - swipe.lastX;

            while (deltaX <= -MOVE_STEP) {
                moveLeft();

                swipe.lastX -= MOVE_STEP;
                deltaX = event.clientX - swipe.lastX;
            }

            while (deltaX >= MOVE_STEP) {
                moveRight();

                swipe.lastX += MOVE_STEP;
                deltaX = event.clientX - swipe.lastX;
            }
        } else {
            const deltaY = event.clientY - swipe.lastY;

            // Свайп угору — обертання.
            if (
                totalY < -SWIPE_START &&
                !swipe.rotated
            ) {
                rotatePiece();

                swipe.rotated = true;
                swipe.lastY = event.clientY;
            }

            // Свайп униз — прискорене падіння.
            else if (deltaY >= DOWN_STEP) {
                const steps = Math.floor(deltaY / DOWN_STEP);

                for (let i = 0; i < steps; i++) {
                    moveDown();

                    if (!gameRunning) break;
                }

                swipe.lastY += steps * DOWN_STEP;
            }
        }
    }, { passive: false });

    const finishSwipe = event => {
        if (!swipe || event.pointerId !== swipe.pointerId) {
            return;
        }

        // Короткий дотик не обертає фігуру.
        // Для обертання потрібно провести пальцем угору.
        swipe = null;
    };

    canvas.addEventListener("pointerup", finishSwipe);
    canvas.addEventListener("pointercancel", finishSwipe);

    canvas.addEventListener("lostpointercapture", () => {
        swipe = null;
    });
}

// =========================
// ВІДПРАВКА СТАНУ
// =========================

function sendGameState() {
    if (!roomCode) return;

    socket.emit("game_state", {
        room: roomCode,
        score: score,
        level: level,
        lines: lines,
        board: board
    });
}

// =========================
// ЗБЕРЕЖЕННЯ РЕКОРДУ
// =========================

async function saveRecord() {
    try {
        const response = await fetch("/save_record", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: playerName,
                score: score,
                level: level,
                lines: lines
            })
        });

        const data = await response.json();

        if (data.success) {
            loadRecords();
        } else {
            console.error(
                "Не вдалося зберегти рекорд:",
                data.error
            );
        }
    } catch (error) {
        console.error("Помилка збереження рекорду:", error);
    }
}

// =========================
// ЗАВАНТАЖЕННЯ РЕКОРДІВ
// =========================

async function loadRecords() {
    try {
        const response = await fetch("/records");
        const records = await response.json();

        recordsBody.innerHTML = "";

        if (records.length === 0) {
            recordsBody.innerHTML = `
                <tr>
                    <td colspan="5">Рекордів ще немає</td>
                </tr>
            `;

            return;
        }

        records.forEach((record, index) => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${escapeHtml(record.name)}</td>
                <td>${record.score}</td>
                <td>${record.level}</td>
                <td>${record.lines}</td>
            `;

            recordsBody.appendChild(row);
        });
    } catch (error) {
        recordsBody.innerHTML = `
            <tr>
                <td colspan="5">Не вдалося завантажити рекорди</td>
            </tr>
        `;
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;

    return div.innerHTML;
}

// =========================
// GAME OVER
// =========================

function showGameOver(title, text) {
    gameOverTitle.textContent = title;
    gameOverText.textContent = text;

    gameOver.classList.remove("hidden");

    loadRecords();
}

function closeGameOver() {
    gameOver.classList.add("hidden");
}

// =========================
// РЕСТАРТ
// =========================

restartBtn.onclick = () => {
    closeGameOver();

    if (gameMode === "solo") {
        startGame();
    } else {
        socket.emit("restart_match", {
            room: roomCode
        });
    }
};

socket.on("match_restart", () => {
    startGame();
});

// =========================
// ПОВЕРНЕННЯ В МЕНЮ
// =========================

backBtn.onclick = () => {
    location.reload();
};

leaveBtn.onclick = () => {
    location.reload();
};

// =========================
// СУПЕРНИК ВИЙШОВ
// =========================

socket.on("opponent_left", () => {
    gameRunning = false;

    showGameOver(
        "👋 Суперник вийшов",
        "Гру завершено."
    );
});

// =========================
// ПІДКЛЮЧЕННЯ
// =========================

socket.on("connect", () => {
    document.getElementById("connectionStatus").textContent =
        "🟢 Підключено";
});

socket.on("disconnect", () => {
    document.getElementById("connectionStatus").textContent =
        "🔴 Немає з'єднання";
});

// =========================
// ПОЧАТКОВЕ ЗАВАНТАЖЕННЯ
// =========================

loadRecords();

board = createBoard();
opponentBoard = createBoard();

draw();
drawOpponent();
