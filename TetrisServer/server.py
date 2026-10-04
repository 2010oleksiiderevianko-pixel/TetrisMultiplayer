from flask import Flask, send_from_directory, jsonify, request
from flask_socketio import SocketIO, emit, join_room
import random
import string
import json
import os

app = Flask(__name__)
app.config["SECRET_KEY"] = "tetris-secret-key"

socketio = SocketIO(
    app,
    cors_allowed_origins="*"
)

rooms = {}

RECORDS_FILE = "records.json"


# =========================
# РЕКОРДИ
# =========================

def load_records():
    if not os.path.exists(RECORDS_FILE):
        return []

    try:
        with open(RECORDS_FILE, "r", encoding="utf-8") as file:
            data = json.load(file)

        if isinstance(data, list):
            return data

        return []

    except Exception:
        return []


def save_records(records):
    with open(RECORDS_FILE, "w", encoding="utf-8") as file:
        json.dump(records, file, ensure_ascii=False, indent=4)


def add_record(name, score, level, lines):
    records = load_records()

    records.append({
        "name": name,
        "score": int(score),
        "level": int(level),
        "lines": int(lines)
    })

    records.sort(key=lambda x: x["score"], reverse=True)

    records = records[:100]

    save_records(records)

    return records


# =========================
# СТОРІНКИ
# =========================

@app.route("/")
def index():
    return send_from_directory(".", "index.html")


@app.route("/style.css")
def style():
    return send_from_directory(".", "style.css")


@app.route("/game.js")
def game():
    return send_from_directory(".", "game.js")


# =========================
# API РЕКОРДІВ
# =========================

@app.route("/records")
def records():
    return jsonify(load_records()[:10])


@app.route("/save_record", methods=["POST"])
def save_record():
    try:
        data = request.get_json()

        name = str(data.get("name", "Гравець")).strip()
        score = int(data.get("score", 0))
        level = int(data.get("level", 1))
        lines = int(data.get("lines", 0))

        if not name:
            name = "Гравець"

        name = name[:20]

        if score < 0:
            score = 0

        records = add_record(
            name,
            score,
            level,
            lines
        )

        return jsonify({
            "success": True,
            "records": records[:10]
        })

    except Exception as e:
        print("Помилка збереження рекорду:", e)

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# =========================
# КІМНАТИ
# =========================

def generate_room_code():
    while True:
        code = "".join(
            random.choices(
                string.ascii_uppercase + string.digits,
                k=4
            )
        )

        if code not in rooms:
            return code


def send_room_info(room_code):
    if room_code not in rooms:
        return

    room = rooms[room_code]

    players = []

    for player_id, player in room["players"].items():
        players.append({
            "id": player_id,
            "name": player["name"],
            "score": player["score"],
            "level": player["level"],
            "lines": player["lines"],
            "board": player["board"]
        })

    socketio.emit(
        "room_update",
        {
            "room": room_code,
            "players": players
        },
        room=room_code
    )


# =========================
# СТВОРЕННЯ КІМНАТИ
# =========================

@socketio.on("create_room")
def create_room(data):

    name = str(
        data.get("name", "Гравець")
    ).strip()

    if not name:
        name = "Гравець"

    name = name[:20]

    room_code = generate_room_code()

    rooms[room_code] = {
        "players": {},
        "started": False
    }

    rooms[room_code]["players"][request.sid] = {
        "name": name,
        "score": 0,
        "level": 1,
        "lines": 0,
        "board": []
    }

    join_room(room_code)

    emit(
        "room_created",
        {
            "room": room_code,
            "player": 1
        }
    )

    send_room_info(room_code)


# =========================
# ПРИЄДНАННЯ
# =========================

@socketio.on("join_room_game")
def join_room_game(data):

    room_code = str(
        data.get("room", "")
    ).upper().strip()

    name = str(
        data.get("name", "Гравець")
    ).strip()

    if not room_code:
        emit(
            "error_message",
            {
                "message": "Введи код кімнати."
            }
        )
        return

    if room_code not in rooms:
        emit(
            "error_message",
            {
                "message": "Такої кімнати не існує."
            }
        )
        return

    room = rooms[room_code]

    if len(room["players"]) >= 2:
        emit(
            "error_message",
            {
                "message": "Кімната вже заповнена."
            }
        )
        return

    if not name:
        name = "Гравець"

    name = name[:20]

    room["players"][request.sid] = {
        "name": name,
        "score": 0,
        "level": 1,
        "lines": 0,
        "board": []
    }

    join_room(room_code)

    emit(
        "room_joined",
        {
            "room": room_code,
            "player": len(room["players"])
        }
    )

    send_room_info(room_code)


# =========================
# СТАРТ ГРИ
# =========================

@socketio.on("start_match")
def start_match(data):

    room_code = data.get("room")

    if room_code not in rooms:
        return

    room = rooms[room_code]

    if len(room["players"]) < 2:
        emit(
            "error_message",
            {
                "message": "Потрібні 2 гравці."
            }
        )
        return

    room["started"] = True

    socketio.emit(
        "match_started",
        {},
        room=room_code
    )


# =========================
# СТАН ГРАВЦЯ
# =========================

@socketio.on("game_state")
def game_state(data):

    room_code = data.get("room")

    if room_code not in rooms:
        return

    if request.sid not in rooms[room_code]["players"]:
        return

    player = rooms[room_code]["players"][request.sid]

    player["score"] = int(
        data.get("score", 0)
    )

    player["level"] = int(
        data.get("level", 1)
    )

    player["lines"] = int(
        data.get("lines", 0)
    )

    player["board"] = data.get(
        "board",
        []
    )

    for player_id in rooms[room_code]["players"]:

        if player_id != request.sid:

            socketio.emit(
                "opponent_state",
                {
                    "score": player["score"],
                    "level": player["level"],
                    "lines": player["lines"],
                    "board": player["board"]
                },
                to=player_id
            )


# =========================
# ГРАВЕЦЬ ПРОГРАВ
# =========================

@socketio.on("player_lost")
def player_lost(data):

    room_code = data.get("room")

    if room_code not in rooms:
        return

    for player_id in rooms[room_code]["players"]:

        if player_id != request.sid:

            socketio.emit(
                "opponent_won",
                {},
                to=player_id
            )


# =========================
# РЕСТАРТ
# =========================

@socketio.on("restart_match")
def restart_match(data):

    room_code = data.get("room")

    if room_code not in rooms:
        return

    room = rooms[room_code]

    for player in room["players"].values():

        player["score"] = 0
        player["level"] = 1
        player["lines"] = 0
        player["board"] = []

    room["started"] = False

    socketio.emit(
        "match_restart",
        {},
        room=room_code
    )


# =========================
# ВИХІД
# =========================

@socketio.on("disconnect")
def disconnect():

    for room_code in list(rooms.keys()):

        room = rooms[room_code]

        if request.sid in room["players"]:

            del room["players"][request.sid]

            socketio.emit(
                "opponent_left",
                {},
                room=room_code
            )

            if len(room["players"]) == 0:
                del rooms[room_code]

            else:
                room["started"] = False
                send_room_info(room_code)

            break


# =========================
# ЗАПУСК
# =========================

if __name__ == "__main__":

    import os

    port = int(os.environ.get("PORT", 5000))

    print("======================================")
    print("        TETRIS MULTIPLAYER")
    print("======================================")
    print("Сервер запущено!")
    print(f"Порт: {port}")
    print("======================================")

    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=False,
        allow_unsafe_werkzeug=True
    )