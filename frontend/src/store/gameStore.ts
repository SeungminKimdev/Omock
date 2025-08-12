// src/store/gameStore.ts
import { create } from 'zustand'
import type { Cell, GameState, Move, ServerMsg } from '@/types'

function make2D(n: number, v: number) {
  return Array.from({ length: n }, () => Array(n).fill(v)) as GameState['grid']
}

// 추가: 플레이어 돌만 표현
type Player = 1 | 2
type RoleStr = 'black' | 'white'

// 서버 <-> 로컬 매핑 유틸
const PNUM: Record<RoleStr, Player> = { black: 1, white: 2 }
function toPlayerNum(role: RoleStr | null | undefined): Player {
  return role === 'white' ? 2 : 1
}
function toRoleStr(p: Player): RoleStr {
  return p === 2 ? 'white' : 'black'
}
function boardFromServer(board: any): GameState['grid'] {
  // 서버 보드: 15x15, 'black' | 'white' | null
  if (!Array.isArray(board)) return make2D(15, 0)
  const n = board.length || 15
  const g = make2D(n, 0)
  for (let y = 0; y < n; y++) {
    const row = Array.isArray(board[y]) ? board[y] : []
    for (let x = 0; x < n; x++) {
      const c = row[x]
      g[y][x] = c === 'black' ? 1 : c === 'white' ? 2 : 0
    }
  }
  return g
}

export interface GameStore {
  // 로컬/공통 게임 상태
  game: GameState
  setGame: (g: GameState) => void
  placeLocal: (x: number, y: number) => void
  undoLocal: () => void
  redoLocal: () => void

  // 온라인 메타
  role: RoleStr | null
  gameId: string | null
  playerId: string | null
  moveNo: number
  connection: 'idle' | 'connecting' | 'open' | 'closed'
  lastError: { code: number; message: string } | null

  setOnlineMeta: (m: Partial<Pick<GameStore, 'role' | 'gameId' | 'playerId' | 'connection'>>) => void
  clearError: () => void

  // 서버 메시지를 반영
  applyServer: (msg: ServerMsg) => void

  // 온라인 보드 초기화(옵션)
  resetToEmpty: (size?: number) => void
}

const initial: GameState = {
  id: 'local',
  size: 15,
  winLen: 5,
  grid: make2D(15, 0),
  history: [],
  cur: 1,
  winning: null,
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: initial,

  role: null,
  gameId: null,
  playerId: null,
  moveNo: 0,
  connection: 'idle',
  lastError: null,

  setGame: (g) => set({ game: g }),
  setOnlineMeta: (m) => set((s) => ({ ...s, ...m })),
  clearError: () => set({ lastError: null }),

  resetToEmpty: (size = 15) =>
    set(() => ({
      game: {
        id: 'online',
        size,
        winLen: 5,
        grid: make2D(size, 0),
        history: [],
        cur: 1,
        winning: null,
      },
      moveNo: 0,
    })),

  placeLocal: (x, y) =>
    set((s) => {
      const g = structuredClone(s.game)
      if (g.winning) return { game: g }
      if (x < 0 || y < 0 || x >= g.size || y >= g.size) return { game: g }
      if (g.grid[y][x] !== 0) return { game: g }

      // cur는 항상 1|2 이므로 Player로 좁혀서 사용
      const color: Player = g.cur as Player

      // Move 타입은 외부 정의에 맞추되, 값은 Player로 생성
      const mv: Move = { x, y, color: color as unknown as Move['color'] }

      g.grid[y][x] = color
      g.history.push(mv)
      g.cur = (3 - g.cur) as Player

      // checkWin은 1|2만 허용 → 명시적으로 Player 전달
      g.winning = checkWin(g, x, y, color)

      return { game: g }
    }),

  undoLocal: () =>
    set((s) => {
      const g = structuredClone(s.game)
      const last = g.history.pop()
      if (!last) return { game: g }
      g.grid[last.y][last.x] = 0
      // last.color가 Stone(0|1|2)로 정의돼 있을 수 있으므로 가드
      const lc = (last as any).color
      g.cur = (lc === 1 || lc === 2 ? lc : g.cur) as Player
      g.winning = null
      return { game: g }
    }),

  redoLocal: () => set((s) => ({ game: s.game })),

  applyServer: (msg) =>
    set((s) => {
      const t = (msg as any)?.type as string
      const p = (msg as any)?.payload as any
      let next: Partial<GameStore> = {}

      // 공통적으로 사용할 현재 게임 복제
      let g = structuredClone(s.game)

      switch (t) {
        case 'assignRole': {
          const role = (p?.role as RoleStr) ?? null
          next.role = role
          return { ...s, ...next }
        }

        case 'state': {
          // 서버 스냅샷 → 로컬 게임 상태로 정규화
          g.id = p?.gameId ?? 'online'
          g.size = Array.isArray(p?.board) ? p.board.length : 15
          g.grid = boardFromServer(p?.board)
          g.history = [] // 온라인은 서버 권위를 따르므로 로컬 히스토리는 비움
          g.cur = toPlayerNum(p?.currentTurn as RoleStr)
          g.winning = p?.gameOver
            ? {
                line: [], // 서버가 승리 라인을 주지 않으므로 표시만
                color: PNUM[(p?.winner as RoleStr) || 'black'],
              }
            : null

          next.game = g
          next.gameId = p?.gameId ?? s.gameId
          next.moveNo = typeof p?.moveNo === 'number' ? p.moveNo : s.moveNo
          return { ...s, ...next }
        }

        case 'gameStart': {
          // 게임 시작: 현재 턴 반영만(보드는 이어서 오는 state/move로 동기화됨)
          const curTurn = (p?.currentTurn as RoleStr) || 'black'
          g.cur = toPlayerNum(curTurn)
          next.game = g
          return { ...s, ...next }
        }

        case 'move': {
          // 서버 브로드캐스트된 수를 반영 (낙관적 업데이트 금지)
          const row = p?.row
          const col = p?.col
          const player = p?.player as RoleStr
          const nextTurn = p?.nextTurn as RoleStr
          if (
            typeof row === 'number' &&
            typeof col === 'number' &&
            (player === 'black' || player === 'white')
          ) {
            // 방어: 범위 체크 후 적용
            if (row >= 0 && col >= 0 && row < g.size && col < g.size) {
              const color: Player = PNUM[player]
              g.grid[row][col] = color
              const mv: Move = { x: col, y: row, color: color as unknown as Move['color'] }
              g.history.push(mv)
              g.cur = toPlayerNum(nextTurn || 'black')
              // 승리여부는 server의 gameOver가 이어서 올 수 있으므로 여기서도 탐지(하이라이트 용)
              g.winning = checkWin(g, col, row, color) || g.winning
            }
          }
          next.game = g
          next.moveNo = typeof p?.moveNo === 'number' ? p.moveNo : s.moveNo + 1
          return { ...s, ...next }
        }

        case 'gameOver': {
          // 승자/사유 적용. 라인은 직전 history를 기반으로 재탐지 시도
          const winner = (p?.winner as RoleStr) || null
          if (winner) {
            const color = PNUM[winner]
            const last = g.history[g.history.length - 1]
            if (last) {
              g.winning = checkWin(g, last.x, last.y, color) || {
                line: [],
                color,
              }
            } else {
              g.winning = { line: [], color }
            }
          }
          next.game = g
          return { ...s, ...next }
        }

        case 'error': {
          const code = typeof p?.code === 'number' ? p.code : -1
          const message = typeof p?.message === 'string' ? p.message : 'Unknown error'
          next.lastError = { code, message }
          return { ...s, ...next }
        }

        // ping/pong, 기타는 상태 변화 없음
        default:
          return s
      }
    }),
}))

function checkWin(g: GameState, x: number, y: number, color: Player) {
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ] as const
  for (const [dx, dy] of dirs) {
    const line: Cell[] = [{ x, y }]
    let i = 1
    while (inB(x + dx * i, y + dy * i, g.size) && g.grid[y + dy * i][x + dx * i] === color) {
      line.push({ x: x + dx * i, y: y + dy * i })
      i++
    }
    i = 1
    while (inB(x - dx * i, y - dy * i, g.size) && g.grid[y - dy * i][x - dx * i] === color) {
      line.unshift({ x: x - dx * i, y: y - dy * i })
      i++
    }
    if (line.length >= g.winLen) {
      const idx = line.findIndex((p) => p.x === x && p.y === y)
      const start = Math.max(0, Math.min(idx - (g.winLen - 1), line.length - g.winLen))
      return { line: line.slice(start, start + g.winLen), color }
    }
  }
  return null
}
function inB(x: number, y: number, n: number) {
  return x >= 0 && y >= 0 && x < n && y < n
}
