// src/App.tsx
import { useEffect, useMemo } from 'react'
import './styles/index.css'
import HeaderBar from './components/HeaderBar'
import Controls from './components/Controls'
import Sidebar from './components/Sidebar'
import BoardCanvas from './components/BoardCanvas'
import { useGameStore } from './store/gameStore'
import { connectWS } from './lib/ws'

function ensurePlayerId() {
  let id = localStorage.getItem('omock:playerId')
  if (!id) {
    id = `guest-${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem('omock:playerId', id)
  }
  return id
}

// 기본 WS URL: .env의 VITE_WS_URL 우선, 없으면 현재 호스트 기준
const WS_URL =
  (import.meta as any).env?.VITE_WS_URL ??
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/omock`

export default function App() {
  const { game, undoLocal, redoLocal, resetToEmpty } = useGameStore()

  // URL에 ?game=... 이 있으면 자동 접속, 없으면 로컬 모드
  const gameId = useMemo(
    () => new URLSearchParams(location.search).get('game') || 'local',
    []
  )

  // 선택적 자동 접속: ?game=local 이 아니면 WS 연결 + joinGame
  useEffect(() => {
    if (gameId === 'local') return
    const playerId = ensurePlayerId()

    const ws = connectWS(
      WS_URL,
      (msg) => {
        useGameStore.getState().applyServer(msg)
      },
      {
        joinOnOpen: { gameId, playerId },
        onOpen: () => {
          useGameStore.getState().setOnlineMeta?.({
            connection: 'open',
            playerId,
            gameId,
          })
        },
        onClose: () => {
          useGameStore.getState().setOnlineMeta?.({
            connection: 'closed',
            role: null,
          })
        },
      }
    )
    return () => ws.close()
  }, [gameId])

  // 단축키: Z(undo) / Y(redo) / N(new)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase()
      if (k === 'z') useGameStore.getState().undoLocal()
      else if (k === 'y') useGameStore.getState().redoLocal()
      else if (k === 'n') useGameStore.getState().resetToEmpty(game.size)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [game.size])

  const turnLabel = `Turn: ${game.cur === 1 ? 'Black' : 'White'}`

  return (
    <div className="app" role="application" aria-label="Gomoku Board Game">
      <HeaderBar turnLabel={turnLabel} />

      <div className="board-wrap">
        {/* 보드 영역 */}
        <div className="canvas-card">
          <BoardCanvas />
        </div>

        {/* 우측 사이드: 옵션 + 컨트롤(1v1 매칭 포함) */}
        <aside className="side">
          <Sidebar />
          <Controls
            onUndo={undoLocal}
            onRedo={redoLocal}
            onNew={() => resetToEmpty(game.size)}
          />
        </aside>
      </div>

      <footer>Built for clarity &amp; flow. Enjoy!</footer>
    </div>
  )
}
