// src/types/index.ts

// ====== 로컬 게임 상태(기존 유지) ======
export type Stone = 0 | 1 | 2 // 0 empty, 1 black, 2 white
export interface Cell { x: number; y: number }
export interface Move extends Cell { color: Stone }

export interface GameState {
  id: string
  size: number
  winLen: number
  grid: Stone[][]
  history: Move[]
  cur: Stone // 1 or 2
  winning?: { line: Cell[]; color: Stone } | null
}

// ====== 온라인(WS) 프로토콜 타입 ======
export type Role = 'black' | 'white'
export type ISODateString = string

// 서버 보드 표현: 'black' | 'white' | null 의 15x15
export type ServerBoardCell = Role | null
export type ServerBoard = ServerBoardCell[][]

// --- Client -> Server
export type ClientMsg =
  | { type: 'joinGame'; payload: { gameId?: string; playerId: string } }
  | { type: 'move'; payload: { row: number; col: number } }
  | { type: 'resign'; payload: { player: Role } }
  | { type: 'ping'; payload: {} }
  | { type: 'sync'; payload: {} }

// --- Server -> Client
export type ServerMsg =
  | { type: 'assignRole'; payload: { role: Role; serverTs: ISODateString } }
  | {
      type: 'state'
      payload: {
        gameId: string
        board: ServerBoard
        currentTurn: Role
        blackPlayer: string | null
        whitePlayer: string | null
        gameOver: boolean
        winner: Role | null
        moveNo: number
        serverTs: ISODateString
      }
    }
  | {
      type: 'gameStart'
      payload: {
        blackPlayer: string
        whitePlayer: string
        currentTurn: Role
        serverTs: ISODateString
      }
    }
  | {
      type: 'move'
      payload: {
        row: number
        col: number
        player: Role
        nextTurn: Role
        moveNo: number
        serverTs: ISODateString
      }
    }
  | {
      type: 'gameOver'
      payload: {
        winner: Role
        reason: 'fiveInARow' | 'resign' | 'timeout'
        moveNo?: number
        serverTs: ISODateString
      }
    }
  | { type: 'error'; payload: { code: number; message: string } }
  | { type: 'pong'; payload: { serverTs: ISODateString } }
