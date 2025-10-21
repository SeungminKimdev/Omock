// src/components/Controls.tsx
import { useEffect, useRef, useState } from 'react'
import { connectWS } from '@/lib/ws'
import { useGameStore } from '@/store/gameStore'
import type { ServerMsg } from '@/types'

interface Props {
  onUndo: () => void
  onRedo: () => void
  onNew: () => void
}

// 기본 WS URL: VITE_WS_URL이 있으면 사용, 없으면 현재 호스트 기반
const WS_URL =
  (import.meta as any).env?.VITE_WS_URL ??
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/omock`

function ensurePlayerId() {
  let id = localStorage.getItem('omock:playerId')
  if (!id) {
    id = `guest-${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem('omock:playerId', id)
  }
  return id
}

export default function Controls({ onUndo, onRedo, onNew }: Props) {
  const {
    applyServer,
    setOnlineMeta,
    resetToEmpty,
    lastError,
    connection,
    role,
    game,
  } = useGameStore()

  const wsRef = useRef<ReturnType<typeof connectWS> | null>(null)
  const [joining, setJoining] = useState(false)

  // 보드에서 발생시키는 전역 이벤트(omock:try-move)를 수신 → 서버에 move 전송
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { row: number; col: number }
      wsRef.current?.move(detail.row, detail.col)
    }
    window.addEventListener('omock:try-move', handler as EventListener)
    return () =>
      window.removeEventListener('omock:try-move', handler as EventListener)
  }, [])

  // 1v1 매칭 시작 (연결 + joinGame 자동 전송)
  const connect1v1 = () => {
    if (wsRef.current) return
    const playerId = ensurePlayerId()
    const gameId = 'default' // 필요 시 UI로 입력받아 변경 가능
    setJoining(true)
    resetToEmpty(15)
    setOnlineMeta({ connection: 'connecting', playerId, gameId })

    wsRef.current = connectWS(
      WS_URL,
      (m: ServerMsg) => {
        applyServer(m)
      },
      {
        joinOnOpen: { gameId, playerId },
        onOpen: () => {
          setJoining(false)
          setOnlineMeta({ connection: 'open' })
        },
        onClose: () => {
          setJoining(false)
          setOnlineMeta({ connection: 'closed', role: null })
        },
      }
    )
  }

  const disconnect = () => {
    wsRef.current?.close()
    wsRef.current = null
  }

  const resign = () => {
    if (!role) return
    wsRef.current?.resign(role)
  }

  const myTurn =
    !!role &&
    ((role === 'black' && game.cur === 1) || (role === 'white' && game.cur === 2))

  return (
    <div className="controls" aria-label="Game controls">
      {/* 오프라인 기본 컨트롤 */}
      <button onClick={onUndo} title="Undo (Z)">
        <span>↶</span> Undo
      </button>
      <button onClick={onRedo} title="Redo (Y)">
        <span>↷</span> Redo
      </button>
      <button onClick={onNew} title="New Game (N)">
        ⟲ New Game
      </button>

      {/* 구분선(선택) */}
      <span style={{ opacity: 0.5, margin: '0 8px' }}>|</span>

      {/* 온라인 매칭 컨트롤 */}
      {(!wsRef.current || connection === 'closed') && (
        <button onClick={connect1v1} title="Start 1v1 Match">
          🕹️ 1v1 Match
        </button>
      )}

      {(connection === 'connecting' || joining) && (
        <button disabled title="Connecting...">
          ⏳ Matching…
        </button>
      )}

      {wsRef.current && connection === 'open' && (
        <>
          <button onClick={disconnect} title="Disconnect">
            ✖ Disconnect
          </button>
          <button onClick={resign} title="Resign">
            🏳 Resign
          </button>
        </>
      )}

      {/* 상태 표시 */}
      {wsRef.current && (
        <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.9 }}>
          {connection === 'open'
            ? `Connected${role ? ` · You: ${role}` : ''}${
                myTurn ? ' · Your turn' : ''
              }`
            : connection === 'connecting'
            ? 'Connecting…'
            : 'Disconnected'}
          {lastError?.code ? ` · Error ${lastError.code}: ${lastError.message}` : ''}
        </span>
      )}
    </div>
  )
}
