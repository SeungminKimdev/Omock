import asyncio
from typing import Dict, Optional, Literal, List
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.omock import GomokuGame, InvalidMove

Player = Literal["black", "white"]
Cell = Literal['black', 'white', None]

router = APIRouter()


def now_iso() -> str:
    return datetime.now(timezone(timedelta(hours=9))).isoformat()


class Room:
    """A single game room holding sockets and one GomokuGame instance."""

    def __init__(self, game_id: str):
        self.game_id = game_id
        self.game = GomokuGame()
        self.lock = asyncio.Lock()
        # role -> socket
        self.sockets: Dict[Player, WebSocket] = {}
        # role -> playerId (string)
        self.player_ids: Dict[Player, str] = {}
        # message sequencing for ordering on client
        self.move_no: int = 0

    def role_of(self, ws: WebSocket) -> Optional[Player]:
        for role, sock in self.sockets.items():
            if sock is ws:
                return role
        return None

    def opponent_of(self, role: Player) -> Player:
        return "white" if role == "black" else "black"

    def is_full(self) -> bool:
        return len(self.sockets) >= 2

    def snapshot(self) -> dict:
        # JSON-serializable board state
        board: List[List[Optional[Cell]]] = self.game.board
        return {
            "gameId": self.game_id,
            "board": board,
            "currentTurn": self.game.current_player,
            "blackPlayer": self.player_ids.get("black"),
            "whitePlayer": self.player_ids.get("white"),
            "gameOver": self.game.game_over,
            "winner": self.game.winner,
            "moveNo": self.move_no,
            "serverTs": now_iso(),
        }

    async def broadcast(self, message: dict):
        for sock in list(self.sockets.values()):
            await sock.send_json(message)

    async def send_to(self, role: Player, message: dict):
        sock = self.sockets.get(role)
        if sock is not None:
            await sock.send_json(message)


class Rooms:
    """Rooms registry and helpers."""

    def __init__(self):
        self._rooms: Dict[str, Room] = {}
        self._lock = asyncio.Lock()

    async def get(self, game_id: str) -> Room:
        async with self._lock:
            room = self._rooms.get(game_id)
            if room is None:
                room = Room(game_id)
                self._rooms[game_id] = room
            return room

    async def remove_socket(self, ws: WebSocket):
        async with self._lock:
            empty_ids = []
            for gid, room in self._rooms.items():
                role = room.role_of(ws)
                if role:
                    room.sockets.pop(role, None)
                    room.player_ids.pop(role, None)
                if not room.sockets:
                    empty_ids.append(gid)
            for gid in empty_ids:
                self._rooms.pop(gid, None)


rooms = Rooms()


def normalize_type(t: Optional[str]) -> Optional[str]:
    if not t:
        return t
    # accept both camelCase and lowercase variants from the spec examples
    t_low = t.lower()
    mapping = {
        "joingame": "joinGame",
        "joinGame": "joinGame",
        "gamestart": "gameStart",
        "gameStart": "gameStart",
        "move": "move",
        "error": "error",
        "gameover": "gameOver",
        "gameOver": "gameOver",
        "ping": "ping",
        "pong": "pong",
        "resign": "resign",
        "timeout": "timeout",
        "state": "state",
        "sync": "sync",
    }
    return mapping.get(t_low, t)


@router.websocket("/omock")
async def ws_omock(ws: WebSocket):
    await ws.accept()

    room: Optional[Room] = None
    role: Optional[Player] = None
    player_id: Optional[str] = None

    try:
        # First message must be join
        first = await ws.receive_json()
        t = normalize_type(first.get("type"))
        payload = first.get("payload", {}) or {}
        if t != "joinGame":
            await ws.send_json({
                "type": "error",
                "payload": {"code": 4009, "message": "First message must be joinGame"}
            })
            await ws.close()
            return

        game_id = payload.get("gameId") or "default"
        player_id = payload.get("playerId") or "anonymous"

        room = await rooms.get(game_id)

        # Assign role
        if "black" not in room.sockets:
            role = "black"
        elif "white" not in room.sockets:
            role = "white"
        else:
            await ws.send_json({
                "type": "error",
                "payload": {"code": 4091, "message": "Room is full"}
            })
            await ws.close()
            return

        room.sockets[role] = ws
        room.player_ids[role] = player_id

        # 개인에게 역할 통지 + 현재 스냅샷 전달
        await ws.send_json({
            "type": "assignRole",
            "payload": {"role": role, "serverTs": now_iso()}
        })
        await ws.send_json({"type": "state", "payload": room.snapshot()})

        # If two players present -> start game (스냅샷과 함께)
        if room.is_full():
            await room.broadcast({
                "type": "gameStart",
                "payload": {
                    "blackPlayer": room.player_ids.get("black", "unknown"),
                    "whitePlayer": room.player_ids.get("white", "unknown"),
                    "currentTurn": room.game.current_player,
                    "serverTs": now_iso(),
                },
            })
            # 시작 시점 스냅샷
            await room.broadcast({"type": "state", "payload": room.snapshot()})

        # Main loop
        while True:
            msg = await ws.receive_json()
            t = normalize_type(msg.get("type"))
            payload = msg.get("payload", {}) or {}

            # Heartbeat
            if t == "ping":
                await ws.send_json({"type": "pong", "payload": {"serverTs": now_iso()}})
                continue

            # 클라이언트가 상태 동기화 요청
            if t == "sync":
                if room is not None:
                    await ws.send_json({"type": "state", "payload": room.snapshot()})
                continue

            if t == "resign":
                if role is None or room is None:
                    await ws.send_json({"type": "error", "payload": {"code": 4008, "message": "Not joined"}})
                    continue
                # Mark game over
                winner: Player = room.opponent_of(role)
                room.game.game_over = True
                room.game.winner = winner
                await room.broadcast({
                    "type": "gameOver",
                    "payload": {"winner": winner, "reason": "resign", "serverTs": now_iso()},
                })
                continue

            if t == "move":
                if role is None or room is None:
                    await ws.send_json({"type": "error", "payload": {"code": 4008, "message": "Not joined"}})
                    continue

                if not room.is_full():
                    await ws.send_json({"type": "error", "payload": {"code": 4090, "message": "Waiting for opponent"}})
                    continue

                if room.game.current_player != role:
                    await ws.send_json({"type": "error", "payload": {"code": 4007, "message": "Not your turn"}})
                    continue

                row = payload.get("row")
                col = payload.get("col")
                if not isinstance(row, int) or not isinstance(col, int):
                    await ws.send_json({"type": "error", "payload": {"code": 4010, "message": "row/col must be integers"}})
                    continue

                async with room.lock:
                    try:
                        next_turn, reason = room.game.place_stone(row, col)
                        room.move_no += 1
                    except InvalidMove as e:
                        await ws.send_json({"type": "error", "payload": {"code": e.code, "message": str(e)}})
                        continue

                    # Broadcast the accepted move (상대/본인 모두 수신)
                    await room.broadcast({
                        "type": "move",
                        "payload": {
                            "row": row,
                            "col": col,
                            "player": role,
                            "nextTurn": next_turn,
                            "moveNo": room.move_no,
                            "serverTs": now_iso(),
                        },
                    })

                    if reason is not None:
                        # Game over (e.g., fiveInARow)
                        await room.broadcast({
                            "type": "gameOver",
                            "payload": {"winner": role, "reason": reason, "moveNo": room.move_no, "serverTs": now_iso()},
                        })
                        continue

                continue

            # Unknown / unsupported types
            await ws.send_json({
                "type": "error",
                "payload": {"code": 4999, "message": f"Unsupported type: {t}"}
            })

    except WebSocketDisconnect:
        # Cleanup on disconnect
        pass
    finally:
        await rooms.remove_socket(ws)
