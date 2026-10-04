const socket = io();


// =========================
// НАЛАШТУВАННЯ
// =========================

const COLS = 10;
const ROWS = 20;

const BLOCK = 30;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const opponentCanvas =
    document.getElementById("opponentCanvas");

const opponentCtx =
    opponentCanvas.getContext("2d");


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


// =========================
// ФІГУРИ
// =========================

const pieces = [
    {
        shape: [
            [1, 1, 1, 1]
        ],
        color: "#00ffff"
    },

    {
        shape: [
            [1, 1],
            [1, 1]
        ],
        color: "#ffff00"
    },

    {
        shape: [
            [0, 1, 0],
            [1, 1, 1]
        ],
        color: "#aa55ff"
    },

    {
        shape: [
            [0, 1, 1],
            [1, 1, 0]
        ],
        color: "#55ff55"
    },

    {
        shape: [
            [1, 1, 0],
            [0, 1, 1]
        ],
        color: "#ff5555"
    },

    {
        shape: [
            [1, 0, 0],
            [1, 1, 1]
        ],
        color: "#5588ff"
    },

    {
        shape: [
            [0, 0, 1],
            [1, 1, 1]
        ],
        color: "#ff9955"
    }
];


// =========================
// DOM
// =========================

const lobby =
    document.getElementById("lobby");

const roomPanel =
    document.getElementById("roomPanel");

const gamePanel =
    document.getElementById("gamePanel");

const playerNameInput =
    document.getElementById("playerName");

const roomInput =
    document.getElementById("roomCode");

const createBtn =
    document.getElementById("createBtn");

const joinBtn =
    document.getElementById("joinBtn");

const startBtn =
    document.getElementById("startBtn");

const leaveBtn =
    document.getElementById("leaveBtn");

const restartBtn =
    document.getElementById("restartBtn");

const backBtn =
    document.getElementById("backBtn");

const errorText =
    document.getElementById("errorText");

const roomCodeDisplay =
    document.getElementById("roomCodeDisplay");

const roomStatus =
    document.getElementById("roomStatus");

const myNameText =
    document.getElementById("myName");

const opponentNameText =
    document.getElementById("opponentName");

const scoreText =
    document.getElementById("score");

const linesText =
    document.getElementById("lines");

const levelText =
    document.getElementById("level");

const opponentScoreText =
    document.getElementById("opponentScore");

const opponentLinesText =
    document.getElementById("opponentLines");

const opponentLevelText =
    document.getElementById("opponentLevel");

const recordsBody =
    document.getElementById("recordsBody");

const gameOver =
    document.getElementById("gameOver");

const gameOverTitle =
    document.getElementById("gameOverTitle");

const gameOverText =
    document.getElementById("gameOverText");


// =========================
// ДОПОМІЖНІ
// =========================

function createBoard() {

    return Array.from(
        { length: ROWS },
        () =>
            Array(COLS).fill(0)
    );
}


function randomPiece() {

    const source =
        pieces[
            Math.floor(
                Math.random() *
                pieces.length
            )
        ];

    return {
        shape: source.shape.map(
            row => [...row]
        ),

        color: source.color,

        x: Math.floor(
            COLS / 2 -
            source.shape[0].length / 2
        ),

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
// КІМНАТА
// =========================

createBtn.onclick = () => {

    playerName =
        playerNameInput.value.trim();

    if (!playerName) {
        playerName = "Гравець";
    }

    socket.emit(
        "create_room",
        {
            name: playerName
        }
    );
};


joinBtn.onclick = () => {

    playerName =
        playerNameInput.value.trim();

    roomCode =
        roomInput.value.trim().toUpperCase();

    if (!playerName) {
        playerName = "Гравець";
    }

    if (!roomCode) {
        showError(
            "Введи код кімнати."
        );

        return;
    }

    socket.emit(
        "join_room_game",
        {
            name: playerName,
            room: roomCode
        }
    );
};


socket.on(
    "room_created",
    data => {

        roomCode = data.room;

        openRoom();

    }
);


socket.on(
    "room_joined",
    data => {

        roomCode = data.room;

        openRoom();

    }
);


function openRoom() {

    lobby.classList.add("hidden");

    roomPanel.classList.remove(
        "hidden"
    );

    roomCodeDisplay.textContent =
        roomCode;

    myNameText.textContent =
        playerName;

    updateRoomButtons();
}


function updateRoomButtons() {

    const cards =
        document.querySelectorAll(
            ".playerCard"
        );

    if (cards.length) {
        // Просто залишаємо UI стабільним
    }
}


socket.on(
    "room_update",
    data => {

        const players =
            data.players;

        if (players.length === 1) {

            roomStatus.textContent =
                "Очікуємо другого гравця...";

            opponentNameText.textContent =
                "Очікування...";

            startBtn.disabled = true;

        }

        if (players.length === 2) {

            roomStatus.textContent =
                "Готово! Можна починати.";

            const opponent =
                players.find(
                    p => p.id !== socket.id
                );

            if (opponent) {

                opponentNameText.textContent =
                    opponent.name;

            }

            startBtn.disabled = false;

        }

    }
);


socket.on(
    "error_message",
    data => {

        showError(
            data.message
        );

    }
);


// =========================
// СТАРТ
// =========================

startBtn.onclick = () => {

    socket.emit(
        "start_match",
        {
            room: roomCode
        }
    );
};


socket.on(
    "match_started",
    () => {

        roomPanel.classList.add(
            "hidden"
        );

        gamePanel.classList.remove(
            "hidden"
        );

        startGame();

    }
);


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

    paused = false;

    gameRunning = true;

    currentPiece = randomPiece();

    updateStats();

    closeGameOver();

    draw();

    lastTime = performance.now();

    requestAnimationFrame(
        gameLoop
    );

    sendGameState();
}


function gameLoop(time = 0) {

    if (!gameRunning) {
        return;
    }

    const delta =
        time - lastTime;

    lastTime = time;

    if (!paused) {

        dropCounter += delta;

        if (dropCounter >
            dropInterval) {

            moveDown();

            dropCounter = 0;

        }

        draw();

    }

    requestAnimationFrame(
        gameLoop
    );
}


// =========================
// КОЛІЗІЇ
// =========================

function collision(
    piece,
    testBoard = board
) {

    for (
        let y = 0;
        y < piece.shape.length;
        y++
    ) {

        for (
            let x = 0;
            x < piece.shape[y].length;
            x++
        ) {

            if (!piece.shape[y][x]) {
                continue;
            }

            const boardX =
                piece.x + x;

            const boardY =
                piece.y + y;

            if (
                boardX < 0 ||
                boardX >= COLS ||
                boardY >= ROWS
            ) {
                return true;
            }

            if (
                boardY >= 0 &&
                testBoard[boardY][boardX]
            ) {
                return true;
            }

        }

    }

    return false;
}


// =========================
// РУХ
// =========================

function moveLeft() {

    if (!gameRunning || paused) {
        return;
    }

    currentPiece.x--;

    if (
        collision(currentPiece)
    ) {
        currentPiece.x++;
    }

    draw();
}


function moveRight() {

    if (!gameRunning || paused) {
        return;
    }

    currentPiece.x++;

    if (
        collision(currentPiece)
    ) {
        currentPiece.x--;
    }

    draw();
}


function moveDown() {

    if (!gameRunning || paused) {
        return;
    }

    currentPiece.y++;

    if (
        collision(currentPiece)
    ) {

        currentPiece.y--;

        merge();

        clearLines();

        currentPiece =
            randomPiece();

        if (
            collision(currentPiece)
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

    if (!gameRunning || paused) {
        return;
    }

    while (
        !collision(currentPiece)
    ) {

        currentPiece.y++;

    }

    currentPiece.y--;

    merge();

    clearLines();

    currentPiece =
        randomPiece();

    if (
        collision(currentPiece)
    ) {

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

    if (!gameRunning || paused) {
        return;
    }

    const oldShape =
        currentPiece.shape.map(
            row => [...row]
        );

    const rows =
        currentPiece.shape.length;

    const cols =
        currentPiece.shape[0].length;

    const rotated = [];

    for (
        let x = 0;
        x < cols;
        x++
    ) {

        rotated[x] = [];

        for (
            let y = rows - 1;
            y >= 0;
            y--
        ) {

            rotated[x].push(
                currentPiece.shape[y][x]
            );

        }

    }

    currentPiece.shape =
        rotated;

    if (
        collision(currentPiece)
    ) {

        currentPiece.shape =
            oldShape;

    }

    draw();
}


// =========================
// ЗЛИТТЯ
// =========================

function merge() {

    currentPiece.shape.forEach(
        (row, y) => {

            row.forEach(
                (value, x) => {

                    if (value) {

                        const boardY =
                            currentPiece.y + y;

                        const boardX =
                            currentPiece.x + x;

                        if (
                            boardY >= 0 &&
                            boardY < ROWS &&
                            boardX >= 0 &&
                            boardX < COLS
                        ) {

                            board[boardY][boardX] =
                                currentPiece.color;

                        }

                    }

                }
            );

        }
    );
}


// =========================
// ЛІНІЇ
// =========================

function clearLines() {

    let cleared = 0;

    outer:
    for (
        let y = ROWS - 1;
        y >= 0;
        y--
    ) {

        for (
            let x = 0;
            x < COLS;
            x++
        ) {

            if (!board[y][x]) {
                continue outer;
            }

        }

        board.splice(y, 1);

        board.unshift(
            Array(COLS).fill(0)
        );

        cleared++;

        y++;
    }

    if (cleared > 0) {

        const points = [
            0,
            100,
            300,
            500,
            800
        ];

        score +=
            points[cleared] *
            level;

        lines += cleared;

        level =
            Math.floor(lines / 10) + 1;

        dropInterval =
            Math.max(
                100,
                800 -
                (level - 1) * 60
            );

        updateStats();

    }
}


// =========================
// ГРАВЕЦЬ ПРОГРАВ
// =========================

function loseGame() {

    gameRunning = false;

    socket.emit(
        "player_lost",
        {
            room: roomCode
        }
    );

    saveRecord();

    showGameOver(
        "💀 Ти програв!",
        `Твій рахунок: ${score}`
    );
}


// =========================
// ПЕРЕМОГА
// =========================

socket.on(
    "opponent_won",
    () => {

        if (!gameRunning) {
            return;
        }

        gameRunning = false;

        saveRecord();

        showGameOver(
            "🏆 Ти переміг!",
            `Твій рахунок: ${score}`
        );

    }
);


// =========================
// СТАН СУПЕРНИКА
// =========================

socket.on(
    "opponent_state",
    data => {

        opponentBoard =
            data.board || [];

        opponentScoreText.textContent =
            data.score || 0;

        opponentLevelText.textContent =
            data.level || 1;

        opponentLinesText.textContent =
            data.lines || 0;

        drawOpponent();

    }
);


// =========================
// ОНОВЛЕННЯ СТАТИСТИКИ
// =========================

function updateStats() {

    scoreText.textContent =
        score;

    linesText.textContent =
        lines;

    levelText.textContent =
        level;

}


// =========================
// МАЛЮВАННЯ
// =========================

function drawBoard(
    context,
    targetBoard
) {

    context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    context.fillStyle =
        "#050812";

    context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    // Сітка

    context.strokeStyle =
        "rgba(255,255,255,0.05)";

    context.lineWidth = 1;

    for (
        let x = 0;
        x <= COLS;
        x++
    ) {

        context.beginPath();

        context.moveTo(
            x * BLOCK,
            0
        );

        context.lineTo(
            x * BLOCK,
            ROWS * BLOCK
        );

        context.stroke();

    }

    for (
        let y = 0;
        y <= ROWS;
        y++
    ) {

        context.beginPath();

        context.moveTo(
            0,
            y * BLOCK
        );

        context.lineTo(
            COLS * BLOCK,
            y * BLOCK
        );

        context.stroke();

    }


    // Кубики

    for (
        let y = 0;
        y < ROWS;
        y++
    ) {

        for (
            let x = 0;
            x < COLS;
            x++
        ) {

            if (
                targetBoard[y] &&
                targetBoard[y][x]
            ) {

                drawBlock(
                    context,
                    x,
                    y,
                    targetBoard[y][x]
                );

            }

        }

    }
}


function drawBlock(
    context,
    x,
    y,
    color
) {

    context.fillStyle =
        color;

    context.fillRect(
        x * BLOCK + 1,
        y * BLOCK + 1,
        BLOCK - 2,
        BLOCK - 2
    );

    context.strokeStyle =
        "rgba(255,255,255,0.3)";

    context.strokeRect(
        x * BLOCK + 2,
        y * BLOCK + 2,
        BLOCK - 4,
        BLOCK - 4
    );
}


function drawPiece() {

    if (!currentPiece) {
        return;
    }

    currentPiece.shape.forEach(
        (row, y) => {

            row.forEach(
                (value, x) => {

                    if (value) {

                        drawBlock(
                            ctx,
                            currentPiece.x + x,
                            currentPiece.y + y,
                            currentPiece.color
                        );

                    }

                }
            );

        }
    );
}


function draw() {

    drawBoard(
        ctx,
        board
    );

    drawPiece();
}


function drawOpponent() {

    drawBoard(
        opponentCtx,
        opponentBoard
    );
}


// =========================
// КЕРУВАННЯ
// =========================

document.addEventListener(
    "keydown",
    event => {

        if (!gameRunning) {
            return;
        }

        if (
            event.code ===
            "ArrowLeft"
        ) {

            event.preventDefault();

            moveLeft();

        }

        else if (
            event.code ===
            "ArrowRight"
        ) {

            event.preventDefault();

            moveRight();

        }

        else if (
            event.code ===
            "ArrowDown"
        ) {

            event.preventDefault();

            moveDown();

        }

        else if (
            event.code ===
            "ArrowUp"
        ) {

            event.preventDefault();

            rotatePiece();

        }

        else if (
            event.code ===
            "Space"
        ) {

            event.preventDefault();

            hardDrop();

        }

        else if (
            event.key.toLowerCase() ===
            "p"
        ) {

            paused = !paused;

        }

    }
);


// =========================
// ВІДПРАВКА СТАНУ
// =========================

function sendGameState() {

    if (!roomCode) {
        return;
    }

    socket.emit(
        "game_state",
        {
            room: roomCode,
            score: score,
            level: level,
            lines: lines,
            board: board
        }
    );
}


// =========================
// РЕКОРД
// =========================

async function saveRecord() {

    try {

        const response =
            await fetch(
                "/save_record",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        name: playerName,
                        score: score,
                        level: level,
                        lines: lines
                    })
                }
            );

        const data =
            await response.json();

        if (data.success) {

            loadRecords();

        } else {

            console.error(
                "Не вдалося зберегти рекорд:",
                data.error
            );

        }

    } catch (error) {

        console.error(
            "Помилка збереження рекорду:",
            error
        );

    }
}


// =========================
// ЗАВАНТАЖЕННЯ РЕКОРДІВ
// =========================

async function loadRecords() {

    try {

        const response =
            await fetch("/records");

        const records =
            await response.json();

        recordsBody.innerHTML = "";

        if (
            records.length === 0
        ) {

            recordsBody.innerHTML =
                `
                <tr>
                    <td colspan="5">
                        Рекордів ще немає
                    </td>
                </tr>
                `;

            return;
        }


        records.forEach(
            (record, index) => {

                const row =
                    document.createElement(
                        "tr"
                    );

                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${escapeHtml(record.name)}</td>
                    <td>${record.score}</td>
                    <td>${record.level}</td>
                    <td>${record.lines}</td>
                `;

                recordsBody.appendChild(
                    row
                );

            }
        );

    } catch (error) {

        recordsBody.innerHTML =
            `
            <tr>
                <td colspan="5">
                    Не вдалося завантажити рекорди
                </td>
            </tr>
            `;

    }
}


function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


// =========================
// GAME OVER
// =========================

function showGameOver(
    title,
    text
) {

    gameOverTitle.textContent =
        title;

    gameOverText.textContent =
        text;

    gameOver.classList.remove(
        "hidden"
    );

    loadRecords();
}


function closeGameOver() {

    gameOver.classList.add(
        "hidden"
    );
}


// =========================
// РЕСТАРТ
// =========================

restartBtn.onclick = () => {

    closeGameOver();

    socket.emit(
        "restart_match",
        {
            room: roomCode
        }
    );
};


socket.on(
    "match_restart",
    () => {

        startGame();

    }
);


// =========================
// В МЕНЮ
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

socket.on(
    "opponent_left",
    () => {

        gameRunning = false;

        showGameOver(
            "👋 Суперник вийшов",
            "Гру завершено."
        );

    }
);


// =========================
// ПІДКЛЮЧЕННЯ
// =========================

socket.on(
    "connect",
    () => {

        document.getElementById(
            "connectionStatus"
        ).textContent =
            "🟢 Підключено";

    }
);


socket.on(
    "disconnect",
    () => {

        document.getElementById(
            "connectionStatus"
        ).textContent =
            "🔴 Немає з'єднання";

    }
);


// =========================
// ПОЧАТКОВЕ ЗАВАНТАЖЕННЯ
// =========================

loadRecords();

board = createBoard();

opponentBoard = createBoard();

draw();

drawOpponent();